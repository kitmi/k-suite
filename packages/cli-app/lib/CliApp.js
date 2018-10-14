"use strict";

const Util = require('rk-utils');

const Promise = Util.Promise;
const _ = Util._;
const fs = Util.fs;

const path = require('path');

const EventEmitter = require('events');

const Feature = require('./enum/Feature.js');

const Literal = require('./enum/Literal.js');

const winston = require('winston');

const winstonFlight = require('winstonflight');

const ConfigLoader = require('rk-config');

class CliApp extends EventEmitter {
  constructor(name, options) {
    super();

    this._onUncaughtException = err => {
      this.log('error', err);
    };

    this._onWarning = warning => {
      this.log('warn', warning);
    };

    this._onExit = code => {
      if (this.started) {
        this.stop_();
      }
    };

    this.name = name || 'unnamed_worker';
    this.options = Object.assign({
      logger: {
        "level": options && options.verbose ? "verbose" : "info",
        "transports": [{
          "type": "console",
          "options": {
            "format": winston.format.combine(winston.format.colorize(), winston.format.simple())
          }
        }, {
          "type": "file",
          "options": {
            "level": "info",
            "filename": `${name && _.kebabCase(name) || 'app'}.log`
          }
        }]
      }
    }, options);
    this.env = this.options.env || process.env.NODE_ENV || "development";
    this.workingPath = this.options.workingPath ? path.resolve(this.options.workingPath) : process.cwd();
    this.configPath = this.toAbsolutePath(this.options.configPath || Literal.DEFAULT_CONFIG_PATH);
    this.configName = this.options.configName || Literal.APP_CFG_NAME;
  }

  async start_() {
    this._initialize();

    this._featureRegistry = {
      '*': this._getFeatureFallbackPath()
    };
    this.features = {};
    this.services = {};
    this.configLoader = ConfigLoader.createEnvAwareJsonLoader(this.configPath, this.configName, this.env);
    await this.loadConfig_();

    if (_.isEmpty(this.config)) {
      throw Error('Empty configuration. Nothing to do!');
    }

    this.emit('configLoaded');
    await this._loadFeatures_();
    this.emit('ready');
    this.started = true;
    return this;
  }

  async stop_() {
    this.emit('stopping');
    this.started = false;
    delete this.services;
    delete this.features;
    delete this._featureRegistry;
    delete this.config;
    delete this.configLoader;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this._uninitialize();

        resolve(this);
      }, 0);
    });
  }

  async loadConfig_() {
    let configVariables = this._getConfigVariables();

    this.config = await this.configLoader.load_(configVariables);
    return this;
  }

  toAbsolutePath(...args) {
    if (args.length === 0) {
      return this.workingPath;
    }

    return path.resolve(this.workingPath, ...args);
  }

  registerService(name, serviceObject, override) {
    if (name in this.services && !override) {
      throw new Error('Service "' + name + '" already registered!');
    }

    this.services[name] = serviceObject;
    return this;
  }

  getService(name) {
    return this.services[name];
  }

  enabled(feature) {
    return this.features.hasOwnProperty(feature);
  }

  addFeatureRegistry(registry) {
    if (registry.hasOwnProperty('*')) {
      Util.putIntoBucket(this._featureRegistry, '*', registry['*']);
    }

    Object.assign(this._featureRegistry, _.omit(registry, ['*']));
  }

  log(level, message, ...rest) {
    this.logger.log(level, message, ...rest);
    return this;
  }

  _getConfigVariables() {
    return {
      'app': this,
      'log': winston,
      'env': this.env
    };
  }

  _getFeatureFallbackPath() {
    return [path.resolve(__dirname, Literal.FEATURES_PATH), this.toAbsolutePath(Literal.FEATURES_PATH)];
  }

  _initialize() {
    this._pwd = process.cwd();

    if (this.workingPath !== this._pwd) {
      process.chdir(this.workingPath);
    }

    this._injectLogger();

    this._injectErrorHandlers();

    process.on('exit', this._onExit);
  }

  _uninitialize() {
    process.removeListener('exit', this._onExit);
    const detach = true;

    this._injectErrorHandlers(detach);

    this._injectLogger(detach);

    process.chdir(this._pwd);
    delete this._pwd;
  }

  _injectLogger(detach) {
    if (detach) {
      this.log('verbose', 'Logger is detaching ...');
      this.logger.close();
      delete this.logger;
      return;
    }

    let loggerOpt = this.options.logger;

    if (loggerOpt.transports) {
      loggerOpt.transports = winstonFlight(winston, loggerOpt.transports);
    }

    this.logger = winston.createLogger(loggerOpt);
    this.log('verbose', 'Logger injected.');
  }

  _injectErrorHandlers(detach) {
    if (detach) {
      this.log('verbose', 'Error handlers are detaching ...');
      process.removeListener('warning', this._onWarning);
      process.removeListener('uncaughtException', this._onUncaughtException);
      return;
    }

    process.on('uncaughtException', this._onUncaughtException);
    process.on('warning', this._onWarning);
  }

  async _loadFeatures_() {
    let configStageFeatures = [];

    _.forOwn(this.config, (featureOptions, name) => {
      let feature;

      try {
        feature = this._loadFeature(name);
      } catch (err) {}

      if (feature && feature.type === Feature.CONF) {
        configStageFeatures.push([name, feature.load_, featureOptions]);
        delete this.config[name];
      }
    });

    if (configStageFeatures.length > 0) {
      configStageFeatures.forEach(([name]) => {
        delete this.config[name];
      });
      await this._loadFeatureGroup_(configStageFeatures, Feature.CONF);
      return this._loadFeatures_();
    }

    let featureGroups = {
      [Feature.INIT]: [],
      [Feature.SERVICE]: [],
      [Feature.PLUGIN]: []
    };

    _.forOwn(this.config, (featureOptions, name) => {
      let feature = this._loadFeature(name);

      if (!(feature.type in featureGroups)) {
        throw new Error(`Invalid feature type. Feature: ${name}, type: ${feature.type}`);
      }

      featureGroups[feature.type].push([name, feature.load_, featureOptions]);
    });

    return Util.eachAsync_(featureGroups, (group, level) => this._loadFeatureGroup_(group, level));
  }

  async _loadFeatureGroup_(featureGroup, groupLevel) {
    this.emit('before:' + groupLevel);
    this.log('verbose', `Loading "${groupLevel}" feature group ...`);
    await Util.eachAsync_(featureGroup, async ([name, load_, options]) => {
      this.emit('before:load:' + name);
      this.log('verbose', `Loading feature "${name}" ...`);
      await load_(this, options);
      this.log('verbose', `Feature "${name}" loaded. [OK]`);
      this.emit('after:load:' + name);
    });
    this.log('verbose', `Finished loading "${groupLevel}" feature group. [OK]`);
    this.emit('after:' + groupLevel);
  }

  _loadFeature(feature) {
    let featureObject = this.features[feature];
    if (featureObject) return featureObject;
    let featurePath;

    if (this._featureRegistry.hasOwnProperty(feature)) {
      let loadOption = this._featureRegistry[feature];

      if (Array.isArray(loadOption)) {
        if (loadOption.length === 0) {
          throw new Error(`Invalid registry value for feature "${feature}".`);
        }

        featurePath = loadOption[0];
        featureObject = require(featurePath);

        if (loadOption.length > 1) {
          featureObject = Util.getValueByPath(featureObject, loadOption[1]);
        }
      } else {
        featurePath = loadOption;
        featureObject = require(featurePath);
      }
    } else {
      let searchingPath = this._featureRegistry['*'];

      let found = _.findLast(searchingPath, p => {
        featurePath = path.join(p, feature + '.js');
        return fs.existsSync(featurePath);
      });

      if (!found) {
        throw new Error(`Don't know where to load feature "${feature}".`);
      }

      featureObject = require(featurePath);
    }

    if (!Feature.validate(featureObject)) {
      throw new Error(`Invalid feature object loaded from "${featurePath}".`);
    }

    this.features[feature] = featureObject;
    return featureObject;
  }

}

module.exports = CliApp;
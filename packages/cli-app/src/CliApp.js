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

/**
 * CLI worker process template.
 * @class
 * @extends EventEmitter     
 */
class CliApp extends EventEmitter {
    _onUncaughtException = err => {
        this.log('error', err);
    };        

    _onWarning = warning => {
        this.log('warn', warning);   
    };

    _onExit = (code) => {
        if (this.started) {
            this.stop_();
        }           
    };

    /**     
     * @param {string} name - The name of the cli application.     
     * @param {object} [options] - Application options     
     * @property {object} [options.logger] - Logger options
     * @property {bool} [options.verbose=false] - Flag to output trivial information for diagnostics        
     * @property {string} [options.env] - Environment, default to process.env.NODE_ENV
     * @property {string} [options.workingPath] - App's working path, default to process.cwd()
     * @property {string} [options.configPath] - App's config path, default to "conf" under workingPath
     * @property {string} [options.configName] - App's config basename, default to "app"
     */
    constructor(name, options) {
        super();

        /**
         * Name of the app
         * @member {object}         
         **/
        this.name = name || 'unnamed_worker';                

        /**
         * App options
         * @member {object}         
         */
        this.options = Object.assign({
            logger: {
                "level": (options && options.verbose) ? "verbose" : "info",
                "transports": [
                    {
                        "type": "console",
                        "options": {                            
                            "format": winston.format.combine(winston.format.colorize(), winston.format.simple())
                        }
                    },
                    {
                        "type": "file",
                        "options": {
                            "level": "info",
                            "filename": `${name && _.kebabCase(name) || 'app'}.log`
                        }
                    }
                ]
            }
        }, options);

        /**
         * Environment flag
         * @member {string}        
         */
        this.env = this.options.env || process.env.NODE_ENV || "development";

        /**
         * Working directory of this cli app
         * @member {string}         
         */
        this.workingPath = this.options.workingPath ? path.resolve(this.options.workingPath) : process.cwd();     
        
        /**
         * Config path
         * @member {string}         
         */
        this.configPath = this.toAbsolutePath(this.options.configPath || Literal.DEFAULT_CONFIG_PATH);      
        
        /**
         * Config basename
         * @member {string}         
         */
        this.configName = this.options.configName || Literal.APP_CFG_NAME;
    }

    /**
     * Start the cli app     
     * @fires CliApp#configLoaded
     * @fires CliApp#ready
     * @returns {Promise.<CliApp>}
     */
    async start_() {        
        this._initialize();
        
        this._featureRegistry = {
            //firstly look up "features" under current working path, and then try the builtin features path
            '*': this._getFeatureFallbackPath()
        };
        /**
         * Loaded features, name => feature object
         * @member {object}         
         */
        this.features = {};
        /**
         * Loaded services
         * @member {object}         
         */
        this.services = {};                

        /**
         * Configuration loader instance
         * @member {object}         
         */
        this.configLoader = ConfigLoader.createEnvAwareJsonLoader(this.configPath, this.configName, this.env);
        
        await this.loadConfig_();

        if (_.isEmpty(this.config)) {
            throw Error('Empty configuration. Nothing to do!');
        }

        /**
         * Config loaded event.
         * @event CliApp#configLoaded
         */
        this.emit('configLoaded');

        await this._loadFeatures_(); 

        /**
         * App ready
         * @event CliApp#ready
         */
        this.emit('ready');

        /**
         * Flag showing the app is started or not.
         * @member {bool}
         */
        this.started = true;
        
        return this;
    }

    /**
     * Stop the app module     
     * @fires CliApp#stopping
     * @returns {Promise.<CliApp>}
     */
    async stop_() {
        /**
         * App stopping
         * @event CliApp#stopping
         */
        this.emit('stopping');
        this.started = false;

        delete this.services;
        delete this.features;
        delete this._featureRegistry;

        delete this.config;
        delete this.configLoader;        

        return new Promise((resolve, reject) => {
            //deferred execution
            setTimeout(() => {
                this._uninitialize();

                resolve(this);
            }, 0);
        });
    }

    /**
     * @returns {CliApp}
     */
    async loadConfig_() {
        let configVariables = this._getConfigVariables();

        /**
         * App configuration
         * @member {object}         
         */
        this.config = await this.configLoader.load_(configVariables);   

        return this;
    }

    /**
     * Translate a relative path of this app module to an absolute path     
     * @param {array} args - Array of path parts
     * @returns {string}
     */
    toAbsolutePath(...args) {
        if (args.length === 0) {
            return this.workingPath;
        }       

        return path.resolve(this.workingPath, ...args);
    }

    /**
     * Register a service     
     * @param {string} name
     * @param {object} serviceObject
     * @param {boolean} override
     */
    registerService(name, serviceObject, override) {
        if (name in this.services && !override) {
            throw new Error('Service "'+ name +'" already registered!');
        }

        this.services[name] = serviceObject;
        return this;
    }

    /**
     * Get a service from module hierarchy     
     * @param name
     * @returns {object}
     */
    getService(name) {
        return this.services[name];
    }

    /**
     * Check whether a feature is enabled in the app.
     * @param {string} feature 
     * @returns {bool}
     */
    enabled(feature) {
        return this.features.hasOwnProperty(feature);
    }

    /**
     * Add more or overide current feature registry
     * @param {object} registry 
     */
    addFeatureRegistry(registry) {
        // * is used as the fallback location to find a feature
        if (registry.hasOwnProperty('*')) {
            Util.putIntoBucket(this._featureRegistry, '*', registry['*']);
        }

        Object.assign(this._featureRegistry, _.omit(registry, ['*']));
    }

    /**
     * Default log method, may be override by loggers feature
     * @param {string} - Log level
     * @param {string} - Log message
     * @param {...object} - Extra meta data
     * @returns {CliApp}
     */
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
        return [ path.resolve(__dirname, Literal.FEATURES_PATH), this.toAbsolutePath(Literal.FEATURES_PATH) ];
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

    /**
     * Load features
     * @private     
     * @returns {bool}
     */
    async _loadFeatures_() {       
        // run config stage separately first
        let configStageFeatures = [];        

        // load features
        _.forOwn(this.config, (featureOptions, name) => {
            let feature;
            try {
                feature = this._loadFeature(name);                                
            } catch (err) {                
            }   
            
            if (feature && feature.type === Feature.CONF) {                
                configStageFeatures.push([ name, feature.load_, featureOptions ]);
                delete this.config[name];
            }    
        });        
        
        if (configStageFeatures.length > 0) {      
            //configuration features will be overrided by newly loaded config
            configStageFeatures.forEach(([ name ]) => { delete this.config[name]; });
            
            await this._loadFeatureGroup_(configStageFeatures, Feature.CONF);

            //reload all features if any type of configuration feature exists            
            return this._loadFeatures_();
        }

        let featureGroups = {            
            [Feature.INIT]: [],            
            [Feature.SERVICE]: [],            
            [Feature.PLUGIN]: []
        };

        // load features
        _.forOwn(this.config, (featureOptions, name) => {
            let feature = this._loadFeature(name);

            if (!(feature.type in featureGroups)) {
                throw new Error(`Invalid feature type. Feature: ${name}, type: ${feature.type}`);
            }

            featureGroups[feature.type].push([ name, feature.load_, featureOptions ]);
        });

        return Util.eachAsync_(featureGroups, (group, level) => this._loadFeatureGroup_(group, level));
    }

    async _loadFeatureGroup_(featureGroup, groupLevel) {
        this.emit('before:' + groupLevel);
        this.log('verbose', `Loading "${groupLevel}" feature group ...`);
        await Util.eachAsync_(featureGroup, async ([ name, load_, options ]) => {             
            this.emit('before:load:' + name);
            this.log('verbose', `Loading feature "${name}" ...`);
            await load_(this, options);                
            this.log('verbose', `Feature "${name}" loaded. [OK]`);
            this.emit('after:load:' + name);
        });
        this.log('verbose', `Finished loading "${groupLevel}" feature group. [OK]`);
        this.emit('after:' + groupLevel);
    }    

    /**
     * Load a feature object by name.
     * @private
     * @param {string} feature 
     * @returns {object}     
     */
    _loadFeature(feature) {
        let featureObject = this.features[feature];
        if (featureObject) return featureObject;

        let featurePath;

        if (this._featureRegistry.hasOwnProperty(feature)) {          
            //load by registry entry
            let loadOption = this._featureRegistry[feature];            
            
            if (Array.isArray(loadOption)) {
                if (loadOption.length === 0) {
                    throw new Error(`Invalid registry value for feature "${feature}".`);
                }

                featurePath = loadOption[0];
                featureObject = require(featurePath);

                if (loadOption.length > 1) {
                    //one module may contains more than one feature
                    featureObject = Util.getValueByPath(featureObject, loadOption[1]);
                }
            } else {
                featurePath = loadOption;
                featureObject = require(featurePath);
            }                             
        } else {
            //load by fallback paths
            let searchingPath = this._featureRegistry['*'];
    
            //reverse fallback stack
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
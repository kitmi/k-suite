"use strict";

const Util = require('rk-utils');
const Promise = Util.Promise;
const _ = Util._;
const fs = Util.fs;

const path = require('path');
const EventEmitter = require('events');

const Feature = require('./enum/feature.js');
const Literal = require('./enum/literal.js');

const winston = require('winston');
const winstonFlight = require('winstonflight');

const ConfigLoader = require('rk-config');

class CliApp extends EventEmitter {
    /**
     * Loaded features, name => feature object
     * @type {object}
     * @public
     */
    features = undefined;

    /**
     * Loaded services
     * @type {object}
     * @public
     */
    services = undefined;       

    _onUncaughtException = err => {
        this.log('error', err);
    };        

    _onWarning = warning => {
        this.log('warn', warning);   
    };

    _onExit = (code) => {
        if (this.started) {
            this.stop_().then(() => {                
            });
        }           
    };

    /**
     * Back-end cli worker process template.
     * @constructs CliApp
     * @extends EventEmitter     
     * @param {string} name - The name of the cli application.     
     * @param {object} [options] - Application options     
     * @property {object} [options.logger] - Logger options
     * @property {bool} [options.verbose=false] - Flag to output trivial information for diagnostics        
     */
    constructor(name, options) {
        super();

        /**
         * Name of the app
         * @type {object}
         * @public
         **/
        this.name = name || 'unnamed_worker';                

        /**
         * App options
         * @type {object}
         * @public
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
                            "filename": `${name || 'app'}.log`
                        }
                    }
                ]
            }
        }, options);

        /**
         * Environment flag
         * @type {string}
         * @public
         */
        this.env = this.options.env || process.env.NODE_ENV || "development";

        /**
         * Working directory of this cli app
         * @type {string}
         * @public
         */
        this.workingPath = this.options.workingPath ? path.resolve(this.options.workingPath) : process.cwd();     
        
        /**
         * Config path
         * @type {string}
         * @public
         */
        this.configPath = this.toAbsolutePath(this.options.configPath || Literal.DEFAULT_CONFIG_PATH);          
    }

    /**
     * Start the cli app
     * @memberof CliApp
     * @fires CliApp#configLoaded
     * @fires CliApp#ready
     * @returns {Promise.<CliApp>}
     */
    async start_() {        
        this._pwd = process.cwd();
        if (this.workingPath !== this._pwd) {                   
            process.chdir(this.workingPath);
        }      

        this._injectLogger();
        this._injectErrorHandlers(); 
        
        this.features = {};
        this.services = {};        

        let configVariables = {
            'app': this,            
            'log': winston
        };

        /**
         * Configuration loader instance
         * @type {object}
         * @public
         */
        this.configLoader = ConfigLoader.createEnvAwareJsonLoader(this.configPath, Literal.APP_CFG_NAME, this.env);
        /**
         * App configuration
         * @type {object}
         * @public
         */
        this.config = await this.configLoader.load_(configVariables);   

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

        this.started = true;

        process.on('exit', this._onExit);
        
        return this;
    }

    /**
     * Stop the app module
     * @memberof CliApp
     * @fires CliApp#stopping
     * @returns {Promise.<CliApp>}
     */
    async stop_() {
        process.removeListener('exit', this._onExit);

        /**
         * App stopping
         * @event CliApp#ready
         */
        this.emit('stopping');
        this.started = false;

        this.services = undefined;
        this.features = undefined;

        delete this.config;
        delete this.configLoader;        

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const detach = true;
                this._injectErrorHandlers(detach);       
                this._injectLogger(detach);         

                process.chdir(this._pwd);
                delete this._pwd;

                resolve(this);
            }, 0);
        });
    }

    /**
     * Translate a relative path of this app module to an absolute path
     * @memberof CliApp
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
     * @memberof CliApp
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
     * @memberof CliApp
     * @param name
     * @returns {object}
     */
    getService(name) {
        return this.services[name];
    }

    /**
     * Default log method, may be override by loggers feature
     * @memberof CliApp     
     */
    log(...rest) {
        this.logger.log(...rest);
        return this;
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
        let featureGroups = {
            [Feature.CONF]: [],
            [Feature.INIT]: [],            
            [Feature.SERVICE]: [],            
            [Feature.PLUGIN]: []
        };

        // load features
        _.forOwn(this.config, (featureOptions, name) => {
            let feature = this._loadFeature(name);

            if (!feature) {
                throw new Error(`Invalid feature "${name}".`);
            }

            if (!feature.type) {
                throw new Error(`Missing feature type. Feature: ${name}`);
            }

            if (!(feature.type in featureGroups)) {
                throw new Error(`Invalid feature type. Feature: ${name}, type: ${feature.type}`);
            }

            featureGroups[feature.type].push([ name, feature.load_, featureOptions ]);
        });

        // run config stage separately first
        let configStageFeatures = featureGroups[Feature.CONF];
        if (configStageFeatures.length > 0) {       
            //configuration features will be overrided by newly loaded config
            configStageFeatures.forEach(([ name ]) => { delete this.config[name]; });
            
            await this._loadFeatureGroup_(configStageFeatures, Feature.CONF);

            //reload all features if any type of configuration feature exists            
            return this._loadFeatures_();
        }

        delete featureGroups[Feature.CONF];

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

    _loadFeature(feature) {
        let extensionJs = this.toAbsolutePath(Literal.FEATURES_PATH, feature + '.js');

        if (!fs.existsSync(extensionJs)) {
            //built-in features
            extensionJs = path.resolve(__dirname, 'features', feature + '.js');

            if (!fs.existsSync(extensionJs)) {
                throw new Error(`Unknown feature "${feature}".`);
            }
        } 

        return require(extensionJs);
    }
}

module.exports = CliApp;
"use strict";

const Util = require('rk-utils');
const { _, Promise } = Util;

const winston = require('winston');
const winstonFlight = require('winstonflight');
const Logger = require('winston/lib/winston/logger');

/**
 * Runable app mixin.
 * @mixin
 * @param {object} T - Base class.     
 * @returns {object} A runable app class.
 */
const Runable = T => class extends T {
    _onUncaughtException = err => {
        this.log('error', err);
    };        

    _onWarning = warning => {
        this.log('warn', warning);   
    };

    _onExit = code => {
        if (this.started) {
            this.stop_();
        }           
    };

    /**     
     * @param {string} name - The name of the application.     
     * @param {object} [options] - Application options     
     * @property {object} [options.logger] - Logger options
     * @property {bool} [options.verbose=false] - Flag to output trivial information for diagnostics        
     * @property {string} [options.env] - Environment, default to process.env.NODE_ENV
     * @property {string} [options.workingPath] - App's working path, default to process.cwd()
     * @property {string} [options.configPath] - App's config path, default to "conf" under workingPath
     * @property {string} [options.configName] - App's config basename, default to "app"
     * @property {string} [options.disableEnvAwareConfig=false] - Don't use environment-aware config     
     */
    constructor(name, options) {
        super(name, Object.assign({
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
        }, options));        

        this.parentModule = module.parent;
    }

    /**
     * Start the app     
     * @returns {Promise}
     */
    async start_() {        
        this._initialize();
        
        return super.start_();
    }

    /**
     * Stop the app
     * @returns {Promise}
     */
    async stop_() {
        await super.stop_();

        return new Promise((resolve, reject) => {
            //deferred execution
            setTimeout(() => {
                this._uninitialize();

                resolve(this);
            }, 0);
        });
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
            if (this._externalLogger) {
                delete this._externalLogger;
            } else {
                this.logger.close();
            }
            delete this.logger;
            return;
        }

        let loggerOpt = this.options.logger;

        if (loggerOpt instanceof Logger) {
            this.logger = loggerOpt;
            this._externalLogger = true;
        } else {
            if (loggerOpt.transports) {
                loggerOpt.transports = winstonFlight(winston, loggerOpt.transports);
            }

            this.logger = winston.createLogger(loggerOpt);   
        }
        this.log('verbose', 'Logger injected.');            
    }

    _injectErrorHandlers(detach) {
        if (detach) {
            this.log('verbose', 'Process-wide error handlers are detaching ...');
            process.removeListener('warning', this._onWarning);
            process.removeListener('uncaughtException', this._onUncaughtException);
            return;
        }

        process.on('uncaughtException', this._onUncaughtException); 
        process.on('warning', this._onWarning);
        this.log('verbose', 'Process-wide error handlers injected.');            
    }
};

module.exports = Runable;
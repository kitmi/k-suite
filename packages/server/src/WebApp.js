"use strict";

const Util = require('rk-utils');
const Promise = Util.Promise;
const _ = Util._;
const path = require('path');
const AppWithMiddleware = require('./AppWithMiddleware');
const Literal = require('./enum/Literal');

/**
 * Web application module class
 * @class
 * @extends AppWithMiddleware
 */
class WebApp extends AppWithMiddleware {
    /**     
     * @param {WebServer} server
     * @param {string} name - The name of the app module.
     * @param {string} route - The base route of the app module.
     * @param {string} appPath - The path to load the app's module files
     * @param {object} [options] - The app module's extra options defined in its parent's configuration.
     * @property {object} [options.logger] - Logger options
     * @property {bool} [options.verbose=false] - Flag to output trivial information for diagnostics
     * @property {bool} [options.logWithAppName=false] - Flag to include app name in log message
     * @property {string} [options.env] - Environment, default to process.env.NODE_ENV     
     * @property {string} [options.configPath] - App's config path, default to "conf" under modulePath           
     * @property {string} [options.backendPath='server'] - Relative path of back-end server source files
     * @property {string} [options.clientPath='client'] - Relative path of front-end client source files     
     */
    constructor(server, name, route, appPath, options) {    
        super(name, Object.assign({
            workingPath: appPath, 
            configPath: path.join(appPath, Literal.DEFAULT_CONFIG_PATH)
        }, options));

        /**
         * Hosting server.
         * @member {WebServer}
         **/
        this.server = server;        

        /**
         * Mounting route.
         * @member {string}
         */
        this.route = Util.ensureLeftSlash(Util.trimRightSlash(route));        
    }  

    /**
     * Get a service from module hierarchy     
     * @param name
     * @returns {object}
     */
    getService(name) {
        return super.getService(name) || this.server.getService(name);
    }    

    /**
     * Default log method, may be override by loggers feature
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {...object} rest - Extra meta data
     * @returns {CliApp}
     */
    log(level, message, ...rest) {
        if (this.options.logWithAppName) {
            message = '[' + this.name + '] ' + message;
        }
        this.server.log(level, message, ...rest);
        return this;
    }

    _getFeatureFallbackPath() {
        let pathArray = super._getFeatureFallbackPath();
        pathArray.splice(1, 0, path.resolve(__dirname, Literal.FEATURES_PATH), path.resolve(__dirname, Literal.APP_FEATURES_PATH));
        return pathArray;
    }

    _initialize() {
    }

    _uninitialize() {
    }
}

module.exports = WebApp;
"use strict";

const { _, ensureLeftSlash, trimRightSlash } = require('rk-utils');
const path = require('path');
const { ServiceContainer } = require('@k-suite/app');
const Routable = require('./Routable');
const Literal = require('./enum/Literal');

/**
 * Web application module class.
 * @class
 * @extends Routable(ServiceContainer)
 */
class WebModule extends Routable(ServiceContainer) {
    /**     
     * @param {WebServer} server
     * @param {string} name - The name of the app module.
     * @param {string} route - The base route of the app module.
     * @param {string} appPath - The path to load the app's module files
     * @param {object} [options] - The app module's extra options defined in its parent's configuration.          
     * @property {bool} [options.logWithAppName=false] - Flag to include app name in log message.
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
        this.route = ensureLeftSlash(trimRightSlash(route));        
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
     * @returns {Routable}
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

module.exports = WebModule;
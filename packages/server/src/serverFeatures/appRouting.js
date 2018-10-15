"use strict";

/**
 * Enable routing web requests to a child app.
 * @module Feature_AppRouting
 * 
 * @example
 *  
 *  'appRouting': {
 *      '<mounting point>': {
 *          name: 'app name', 
 *          npmModule: false, // whether is a npm module
 *          options: { // module options 
 *          },
 *          settings: { // can be referenced in config file
 *          }
 *      }
 *  } 
 */

const Feature = require('@k-suite/cli-app/lib/enum/Feature');
const path = require('path');
const Util = require('rk-utils');
const Promise = Util.Promise;
const { InvalidConfiguration } = require('../Errors');
const WebApp = require('../WebApp');

module.exports = {

    /**
     * This feature is loaded at plugin stage.
     * @member {string}
     */
    type: Feature.PLUGIN,

    /**
     * Load the feature.
     * @param {WebServer} server - The web server module object.
     * @param {object} routes - Routes and configuration.
     * @returns {Promise.<*>}
     */
    load_: async (server, routes) => Util.eachAsync_(routes, async (config, baseRoute) => {
        if (!config.name) {
            throw new InvalidConfiguration(
                'Missing app name.',
                app,
                `appRouting.${baseRoute}.name`);
        }
    
        let options = Object.assign({ 
            env: server.env, 
            verbose: server.options.verbose, 
            logWithAppName: server.options.logWithAppName 
        }, config.options);

        let appPath;     

        if (config.npmModule) {
            appPath = server.toAbsolutePath('node_modules', config.name);
        } else {
            appPath = path.join(server.appModulesPath, config.name);
        }
    
        let app = new WebApp(server, config.name, baseRoute, appPath, options);
        app.settings = config.settings || {};

        let relativePath = path.relative(server.workingPath, appPath);
        server.log('verbose', `Loading app [${app.name}] from "${relativePath}" ...`);
    
        await app.start_();
        
        server.log('verbose', `App [${app.name}] is loaded.`);

        //delayed the app routes mounting after all plugins of the server are loaded
        server.on('after:' + Feature.PLUGIN, () => {
            server.mountApp(baseRoute, app);
        });        
    })
};
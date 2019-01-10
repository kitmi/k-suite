"use strict";

/**
 * Enable web request routing.
 * @module Feature_Routing
 */

const { Feature } = require('..').enum;
const { _, eachAsync_ } = require('rk-utils');

module.exports = {

    /**
     * This feature is loaded at final stage.
     * @member {string}
     */
    type: Feature.FINAL,

    /**
     * Load the feature.
     * @param {Routable} app - The app module object
     * @param {object} routes - Routes and configuration
     * @returns {Promise.<*>}
     */
    load_: (app, routes) => eachAsync_(routes, async (routersConfig, route) => {
        if (_.isPlainObject(routersConfig)) {
            return eachAsync_(routersConfig, async (options, type) => {
                let loader_ = require('../routers/' + type);
                
                app.log('verbose', `A "${type}" router is created at "${route}" in app [${app.name}].`);

                return loader_(app, route, options);
            });
        } else {
            // 'route': 'method:/path'            
            let mainRoute = '/', baseRoute = route;
            let pos = route.indexOf(':/');

            if (pos !== -1) {
                mainRoute = route.substring(0, pos + 2);
                baseRoute = route.substring(pos + 1);
            }

            let rules = {
                [mainRoute]: routersConfig
            };

            let loader_ = require('../routers/rule');
            app.log('verbose', `A "rule" router is created at "${baseRoute}" in app [${app.name}].`);

            return loader_(app, baseRoute, { rules: rules });
        }
    })
};
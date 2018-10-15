"use strict";

/**
 * Enable web request routing.
 * @module Feature_Routing
 */

const Feature = require('@k-suite/cli-app/lib/enum/Feature');
const Util = require('rk-utils');
const _ = Util._;
const Promise = Util.Promise;
const { InvalidConfiguration } = require('../Errors');

module.exports = {

    /**
     * This feature is loaded at routing stage.
     * @member {string}
     */
    type: Feature.PLUGIN,

    /**
     * Load the feature.
     * @param {CliApp} app - The app module object
     * @param {object} routes - Routes and configuration
     * @returns {Promise.<*>}
     */
    load_: (app, routes) => Util.eachAsync_(routes, async (routersConfig, route) => {
        if (_.isPlainObject(routersConfig)) {
            return Util.eachAsync_(routersConfig, async (options, type) => {
                let loader_ = require('../routers/' + type);
                
                app.log('verbose', `A "${type}" router is created at "${route}" in app [${app.name}].`);

                return loader_(app, route, options);
            });
        } else {
            // 'route': 'method:file.function'
            let rules = {
                '/': routersConfig
            };

            let loader_ = require('../routers/rule');
            app.log('verbose', `A "rule" router is created at "${route}" in app [${app.name}].`);

            return loader_(app, route, { rules: rules });
        }
    })
};
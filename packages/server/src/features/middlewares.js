"use strict";

/**
 * Enable middlewares
 * @module Feature_Middlewares
 */

const Feature = require('@k-suite/cli-app/lib/enum/Feature');
const Util = require('rk-utils');
const Promise = Util.Promise;

module.exports = {

    /**
     * This feature is loaded at plugin stage
     * @member {string}
     */
    type: Feature.PLUGIN,

    /**
     * Load the feature
     * @param {AppWithMiddleware} app - The app module object
     * @param {*} middlewares - Middlewares and options
     * @returns {Promise.<*>}
     */
    load_: function (app, middlewares) {
        app.useMiddlewares(app.router, middlewares);
    }
};
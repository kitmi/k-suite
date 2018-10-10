"use strict";

/**
 * Enable customized settings
 * @module Feature_Settings
 */

const Feature = require('../enum/Feature');

module.exports = {

    /**
     * This feature is loaded at init stage
     * @member {string}
     */
    type: Feature.INIT,

    /**
     * Load the feature
     * @param {CliApp} app - The cli app module object
     * @param {object} settings - Customized settings
     * @returns {Promise.<*>}
     */
    load_: function (app, settings) {
        app.settings = Object.assign({}, settings);
    }
};
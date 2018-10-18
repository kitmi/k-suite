"use strict";

/**
 * Enable customized feature loading source, from npm modules or other location
 * @module Feature_FeatureRegistry
 * 
 * @example
 *  featureRegistry: {
 *    "*": "fallback path",
 *    "feature1": "feature1 file path", // feature1 = require("feature1 file path");
 *    "feature2": [ "feature2 file path", "object path" ] // feature2 = Util.getValueByPath(require("feature2 file path"), "object path")
 *  }
 */

const Feature = require('../enum/Feature');

module.exports = {

    /**
     * This feature is loaded at configuration stage
     * @member {string}
     */
    type: Feature.CONF,

    /**
     * Load the feature
     * @param {CliApp} app - The cli app module object
     * @param {object} registry - Feature loading source registry     
     * @returns {Promise.<*>}
     */
    load_: (app, registry) => {
        app.addFeatureRegistry(registry);
    }
};
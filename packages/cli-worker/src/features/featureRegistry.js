"use strict";

/**
 * Enable customized feature loading source, from npm modules or other location
 * @module Feature_FeatureRegistry
 * 
 * @example
 *  featureRegistry: {
 *    "feature1": "feature1 file path", // feature1 = require("feature1 file path");
 *    "feature2": [ "feature2 file path", "object path" ] // feature2 = Util.getValueByPath(require("feature2 file path"), "object path")
 *  }
 */

const Feature = require('../enum/Feature');
const Util = require('rk-utils');

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
        let orgininalLoader = app.loadFeature;        

        app.loadFeature = (feature) => {            
            if (registry.hasOwnProperty(feature)) {          
                let loadOption = registry[feature];
                let featureObject;
                
                if (Array.isArray(loadOption)) {
                    if (loadOption.length === 0) {
                        throw new Error(`Invalid registry value for feature "${feature}".`);
                    }

                    featureObject = require(loadOption[0]);

                    if (loadOption.length > 1) {
                        featureObject = Util.getValueByPath(featureObject, loadOption[1]);
                    }
                } else {
                    featureObject = require(loadOption);
                }                 
                
                if (!Feature.validate(featureObject)) {
                    throw new Error(`Invalid feature object loaded from "${feature}".`);
                }

                return featureObject;
            }

            return orgininalLoader.bind(app)(feature);
        }
    }
};
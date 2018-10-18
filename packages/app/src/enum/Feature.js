"use strict";

/**
 * Feature loading stage definitions
 * @module Feature
 * 
 * @example
 *   const Feature = require('@k-suite/cli-app/lib/enum/Feature');
 */

/**
 * Feature level definitions.
 * @readonly
 * @enum {string}
 */

module.exports = {
    /**
     * Configuration
     */
    CONF: 'Configure',
    /**
     * Initialization, e.g. bootstrap, settings
     */
    INIT: 'Initial',    
    /**
     * Services, e.g. loggers, i18n
     */
    SERVICE: 'Services',       
    /**
     * Attaching middlewares
     */
    PLUGIN: 'Plugins',

    /**
     * Validate a feature object.
     * @param {object} featureObject - Feature object
     * @property {string} featureObject.type - Feature loading stage
     * @property {function} featureObject.load_ - Feature loading method
     * @returns {bool}
     */
    validate: function (featureObject) {
        return featureObject && featureObject.hasOwnProperty('type') && (typeof featureObject.load_ === 'function');
    }
};
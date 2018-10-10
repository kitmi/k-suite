"use strict";

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
    PLUGIN: 'Plugins'
};
"use strict";

const Literal = require('@k-suite/cli-app/lib/enum/Literal');

/**
 * Common constants
 * @module Literal
 * 
 * @example
 *   const Literal = require('@k-suite/server/lib/enum/Literal');
 */

/**
 * Common constant definitions.
 * @readonly
 * @enum {string}
 */

module.exports = Object.assign({}, Literal, {
    /**
     * App modules path
     */
    APP_MODULES_PATH: 'app_modules',    

    /**
     * Backend files path
     */
    BACKEND_PATH: 'server',

    /**
     * Backend sources path
     */
    BACKEND_SRC_PATH: 'src',

    /**
     * Frontend source files path, e.g. react source
     */
    CLIENT_SRC_PATH: 'client',

    /**
     * Frontend static files path, e.g. images, css, js
     */
    PUBLIC_PATH: 'public',

    /**
     * Middleware files path
     */
    MIDDLEWARES_PATH: 'middlewares',    

    /**
     * Server-wide config file name
     */
    SERVER_CFG_NAME: 'server',    

    /**
     * Server features path
     */
    SERVER_FEATURES_PATH: 'serverFeatures',

    /**
     * App specific features path
     */
    APP_FEATURES_PATH: 'appFeatures',

    /**
     * Controllers files path, under backend folder
     */
    CONTROLLERS_PATH: 'controllers',

    /**
     * Controllers files path, under backend folder
     */
    RESOURCES_PATH: 'resources',

    /**
     * Remote calls controllers path
     */
    REMOTE_CALLS_PATH: 'remoteCalls',

    /**
     * Views files path, under backend folder
     */
    VIEWS_PATH: 'views',

    /**
     * Models files path, under backend folder
     */
    MODELS_PATH: 'models',

    /**
     * Oolong files path
     */
    OOLONG_PATH: 'oolong',

    /**
     * Database scripts path
     */
    DB_SCRIPTS_PATH: 'db',

    /**
     * Locale dictionary files path
     */
    LOCALE_PATH: 'locale',

    /**
     * Default timezone
     */
    DEFAULT_TIMEZONE: 'Australia/Sydney',

    /**
     * Allowed http methods
     */
    ALLOWED_HTTP_METHODS: new Set(['options', 'get', 'head', 'post', 'put', 'delete', 'trace', 'connect'])
});
"use strict";

/**
 * Add access log for every http request
 * @module Middleware_AccessLog
 */

const { requireFeatures } = require('../utils/Helpers');

/**
 * Get a cached middleware from the app's object store.
 * @param {string} name - Name of the middleware stored in the app's object store.
 * @param {RoutableApp} app 
 * @returns {AsyncFunction}
 */
module.exports = (name, app) => {        
    requireFeatures(['objectStore'], app, 'fromStore');

    return app.store.ensureOne(name);
};
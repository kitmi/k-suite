"use strict";

/**
 * Template rendering middleware.
 * @module Middleware_Views
 */

const path = require('path');
const views = require('koa-views');
const Literal = require('../enum/Literal');

/**
 * Initiate the views middleware
 * @param {Object} [options] - Template options
 * @property {string} [options.extension] - Default extension for your views
 * @property {Object} [options.map] - Extensions to engines map
 * @property {Object} [options.options] - View state locals
 * @property {bool} [options.options.cache] - Flag to enable cache 
 * @param {RoutableApp} app - The owner app module
 **/
module.exports = function (options, app) {
    return views(path.join(app.backendPath, Literal.VIEWS_PATH), options);
};
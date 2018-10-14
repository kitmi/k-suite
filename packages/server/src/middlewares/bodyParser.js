"use strict";

/**
 * Http request body parser middleware.
 * @module Middleware_BodyParser
 */

const bodyParser = require('koa-bodyparser');

/**
 * @param [Object] opts
 *   - {String} jsonLimit default '1mb'
 *   - {String} formLimit default '56kb'
 *   - {string} encoding default 'utf-8'
 *   - {Object} extendTypes
 */
module.exports = bodyParser;
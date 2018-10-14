"use strict";

/**
 * Cross-Site Request Forgery (CSRF) middleware
 * @module Middleware_Csrf
 */

const CSRF = require('koa-csrf');

const DEFAULT_OPTS = {
  invalidSessionSecretMessage: 'Invalid session secret',
  invalidSessionSecretStatusCode: 403,
  invalidTokenMessage: 'Invalid CSRF token',
  invalidTokenStatusCode: 403,
  excludedMethods: [ 'GET', 'HEAD', 'OPTIONS' ],
  disableQuery: false
};

module.exports = (options) => new CSRF(Object.assign({}, DEFAULT_OPTS, options));
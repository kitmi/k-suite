"use strict";

/**
 * HTTP method override middleware.
 * @module Middleware_MethodOverride
 */

const koaMethodOverride = require('koa-methodoverride');
const Util = require('rk-utils');

module.exports = (opt) => koaMethodOverride(opt.getter, Util._.omit(opt, 'getter'));
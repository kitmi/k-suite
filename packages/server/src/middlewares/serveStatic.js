"use strict";

/**
 * Static file server middleware.
 * @module Middleware_ServeStatic
 */

const koaStatic = require('koa-static');

let serveStatic = (options, app) => koaStatic(app.publicPath, options);

module.exports = serveStatic;
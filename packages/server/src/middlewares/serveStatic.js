"use strict";

/**
 * Static file server middleware.
 * @module Middleware_ServeStatic
 */

const koaStatic = require('koa-static');

let serveStatic = (options, app) => {    
    return koaStatic(app.publicPath, options);
};

serveStatic.__metaMatchMethods = ['get'];

module.exports = serveStatic;
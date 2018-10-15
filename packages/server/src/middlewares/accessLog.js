"use strict";

/**
 * Add access log for every http request
 * @module Middleware_AccessLog
 */

const Util = require('rk-utils');
const { InvalidConfiguration } = require('../Errors');
const { requireFeatures } = require('../utils/Helpers');
const HttpStatus = require('http-status-codes');

module.exports = (opt, app) => {        
    requireFeatures([ 'timezone', 'loggers' ], app, 'accessLog');    

    if (!opt.logger) {
        throw new InvalidConfiguration('Missing logger id.', app, 'middlewares.accessLog.logger');
    }

    let logger = app.getService('logger:' + opt.logger);
    if (!logger) {
        throw new InvalidConfiguration('Logger not found. Id: ' + opt.logger, app, 'middlewares.accessLog.logger');
    }

    return async (ctx, next) => {
        let startAt = app.now();       

        await next();

        let info = {
            ip: ctx.ip,
            method: ctx.method,
            url: ctx.url,
            originalUrl: ctx.originalUrl,           
            httpVersion: ctx.req.httpVersion,        
            protocol: ctx.protocol.toUpperCase(),
            status: ctx.status,
            size: ctx.length || '-',
            referer: ctx.header['referer'] || '-',
            userAgent: ctx.header['user-agent'] || '-',
            isoTimestamp: startAt.toISO(),        
            duration: app.now().diff(startAt).milliseconds
        };

        let level = 'info';

        if (ctx.status >= 500) {
            level = 'error';
        } else if (ctx.status >= 400) {
            level = 'warn';
        }
        
        logger.log(level, HttpStatus.getStatusText(ctx.status), info);
    };
};
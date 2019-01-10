"use strict";

const { InvalidConfiguration } = require('../Errors');

/**
 * Passport initialization middleware, required to initialize Passport service.
 * @module Middleware_PassportLogin
 */

/**
 * Create a passport authentication middleware.
 * @param {object} opt - Passport options
 * @property {string} opt.strategy - Passport strategy
 * @property {object} [opt.options] - Passport strategy options
 * @property {bool} [opt.customHandler] - Handle authenticate result manually
 * @param {Routable} app
 * @returns {KoaActionFunction}
 */
let createMiddleware = (opt, app) => {
    if (!opt || !opt.strategy) {
        throw new InvalidConfiguration(
            'Missing strategy name.', 
            app, 
            'middlewares.passportAuth.strategy'
        );
    }
    
    let passportService = app.getService('passport');

    if (!passportService) {
        throw new InvalidConfiguration(
            'Passport feature is not enabled.',
            app,
            'passport'
        );
    }

    let options = { ...passportService.config.auth, ...opt.options };

    if (opt.customHandler) {
        return (ctx, next) => {
            return passportService.authenticate(opt.strategy, options, (err, user, info, status) => {
                if (err) {
                    throw err;
                }

                if (user) {
                    return ctx.login(user).then(next);
                }

                ctx.loginError = info;
                if (typeof status === 'number') {
                    ctx.status = status;
                }
                return next();
            })(ctx, next);
        };
    }
    
    return passportService.authenticate(opt.strategy, options);
}

module.exports = createMiddleware;
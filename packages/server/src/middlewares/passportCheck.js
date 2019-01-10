"use strict";

/**
 * Middleware to check user logged in status based on passport
 * @module Middleware_PassportCheck
 */

/**
 * Initialize ensureLoggedIn middleware
 * @param {object} options
 * @param {Routable} app
 */  
module.exports = (opt, app) => {
    let passportService = app.getService('passport');    

    if (!passportService) {
        throw new InvalidConfiguration(
            'Passport feature is not enabled.',
            app,
            'passport'
        );
    }

    let options = { ...passportService.config.auth, ...opt };

    return async (ctx, next) => {
        if (ctx.isAuthenticated()) {
            return next();
        }

        if (options.successReturnToOrRedirect && ctx.session) {
            ctx.session.returnTo = ctx.originalUrl || ctx.url;
        }

        return ctx.redirect(options.loginUrl);
    }
};
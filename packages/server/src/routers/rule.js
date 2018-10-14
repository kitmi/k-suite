"use strict";

const path = require('path');
const Util = require('rk-utils');
const _ = Util._;
const Promise = Util.Promise;

const { InvalidConfiguration } = require('../Errors');
const Literal = require('../enum/Literal');

/**
 * Rule based router.
 * @module Router_Rule 
 */

const Router = require('koa-router');

/** 
 * @param {WebApp} app 
 * @param {string} baseRoute 
 * @param {object} options 
 * @example
 * '<base path>': {
 *     rule: {
 *         middlewares:
 *         rules: {
 *             // type 1, default is "get", methods mapped to one action
 *             '<sub route>': '<controller with relative path>.<action>',
 * 
 *             // type 2, different methods mapped to different method
 *             '<sub route>': {
 *                '<method>': '<controller with relative path>.<action>'
 *             },
 * 
 *             // type 3, with middleware
 *             '<sub route>': {
 *                 '<method>': {
 *                    '<middleware name>': { //middleware options }
 *                 }
 *             },
 * 
 *             // type 4, all methods mapped to one action
 *             '<method>:/<sub route>': '<controller with relative path>.<action>'
 * 
 *             // type 5, all methods mapped to one action
 *             '<method>:/<sub route>': {
 *                 '<middleware name>': { //middleware options }
 *             }
 *         }
 *     }
 * }
 */
function load_(app, baseRoute, options) {    
    let router = baseRoute === '/' ? new Router() : new Router({prefix: baseRoute});

    if (options.middlewares) {
        app.useMiddlewares(router, options.middlewares);
    }

    _.forOwn(options.rules || {}, (methods, subRoute) => {
        let pos = subRoute.indexOf(':/');

        if (pos !== -1) {
            if (pos === 0) {
                throw new InvalidConfiguration(
                    'Invalid route rule syntax: ' + subRoute, 
                    app, 
                    `routing[${baseRoute}].rule.rules`);
            }
            
            // like get:/, or post:/

            let embeddedMethod = subRoute.substr(0, pos).toLocaleLowerCase();
            subRoute = subRoute.substr(pos + 2);

            methods = {[embeddedMethod]: methods};
        }

        subRoute = Util.ensureLeftSlash(subRoute);

        if (typeof methods === 'string') {
            methods = { get: methods };
        }

        _.forOwn(methods, (middlewares, method) => {
            if (!Literal.ALLOWED_HTTP_METHODS.has(method)) {
                throw new InvalidConfiguration(
                    'Unsupported http method: ' + method,
                    app,
                    `routing[${baseRoute}].rule.rules[${subRoute}]`);
            }

            if (typeof middlewares === 'string') {
                middlewares = { action: middlewares };
            } 

            app.addRoute(router, method, subRoute, middlewares);
        });
    });

    app.addRouter(router);
};

module.exports = load_;
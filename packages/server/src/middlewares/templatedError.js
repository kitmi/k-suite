"use strict";

/**
 * Error response middleware with template engines
 * @module Middleware_TemplatedError
 */

const path = require('path');
const { Literal } = require('..').enum;
const { InvalidConfiguration } = require('../Errors');

/**
 * @function
 * @param {Object} options - Template options
 * @property {string} options.template - Path to template written with your template engine
 * @property {string} options.engine - Path to template written with your template engine
 * @property {bool} options.cache - Path to template written with your template engine, default: NODE_ENV != 'development'
 * @property {string} [options.env='development'] - Path to template written with your template engine
 * @property {Array.<string>} options.accepts - Mimetypes passed to ctx.accepts, default: [ 'html', 'text', 'json' ]
 **/
const koaError = require('koa-error');

module.exports = (options, app) => {
    if (!options.template) {        
        if (options.engine && options.engine !== 'swig') {
            throw new InvalidConfiguration(
                'Missing template option.',
                app,
                'middlewares.templatedError.template'
            );        
        }

        options.template = 'defaultError.swig';
    }

    options.template = path.resolve(app.backendPath, Literal.VIEWS_PATH, options.template); 

    if (!options.engine) {
        options.engine = 'swig';
    }

    return koaError(options);
} 
"use strict";

const path = require('path');
const Util = require('rk-utils');
const _ = Util._;
const Promise = Util.Promise;
const Literal = require('../enum/Literal');
const Router = require('koa-router');
const Controller = require('../patterns/Controller');
const { InvalidConfiguration } = require('../Errors');
const { hasMethod } = require('../utils/Helpers');

/**
 * RESTful router.
 * @module Router_Rest
 */

/**
 * Create a RESTful router.
 * @param {*} app 
 * @param {string} baseRoute 
 * @param {objects} options 
 * @property {string} [options.resourcesPath]
 * @property {object|array} [options.middlewares]
 * @example
 *  '<base path>': {
 *      rest: {
 *          resourcesPath:
 *          middlewares:
 *      }
 *  }
 *  
 *  route                          http method    function of ctrl
 *  /:resource                     get            query
 *  /:resource                     post           create
 *  /:resource/:id                 get            detail
 *  /:resource/:id                 put            update
 *  /:resource/:id                 delete         remove 
 */
module.exports = (app, baseRoute, options) => {
    let resourcePath = path.resolve(app.backendPath, options.resourcesPath || Literal.RESOURCES_PATH);
    
    let router = baseRoute === '/' ? new Router() : new Router({prefix: baseRoute});

    if (options.middlewares) {
        app.useMiddlewares(router, options.middlewares);
    }

    router.use((ctx, next) => { ctx.type = 'application/json'; return next(); });

    let resourcesPath = path.join(resourcePath, "**", "*.js");
    let files = Util.glob.sync(resourcesPath, {nodir: true});

    _.each(files, file => {
        let relPath = path.relative(resourcePath, file);          
        let batchUrl = Util.ensureLeftSlash(relPath.substring(0, relPath.length - 3).split(path.sep).map(p => _.kebabCase(p)).join('/'));
        let singleUrl = batchUrl + '/:id'; 
        
        let controller = require(file);
        let isObj = false;
    
        if (controller.prototype instanceof Controller) {
            controller = new controller(app);
            isObj = true;
        }

        if (hasMethod(controller, 'query')) {
            app.addRoute(router, 'get', batchUrl, isObj ? controller.query.bind(controller) : controller.query);
        }

        if (hasMethod(controller, 'create')) {
            app.addRoute(router, 'post', batchUrl, isObj ? controller.create.bind(controller) : controller.create);
        }

        if (hasMethod(controller, 'detail')) {
            app.addRoute(router, 'get', singleUrl, isObj ? controller.detail.bind(controller) : controller.detail);
        }

        if (hasMethod(controller, 'update')) {
            app.addRoute(router, 'put', singleUrl, isObj ? controller.update.bind(controller) : controller.update);
        }

        if (hasMethod(controller, 'remove')) {
            app.addRoute(router, 'del', singleUrl, isObj ? controller.remove.bind(controller) : controller.remove);
        }
    });

    app.addRouter(router);
};
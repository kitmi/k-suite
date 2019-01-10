"use strict";

const path = require('path');
const Util = require('rk-utils');
const _ = Util._;
const Promise = Util.Promise;
const Literal = require('../enum/Literal');
const Router = require('koa-router');
const Controller = require('../patterns/Controller');
const { InvalidConfiguration } = require('../Errors');

/**
 * Module router for mounting a specific controller.
 * @module Router_Module
 */

/**
 * Create a module-based router. 
 * @param {Routable} app
 * @param {string} baseRoute 
 * @param {*} moduleItem 
 * @example
 *   '<base path>': {    
 *       module: {
 *           middlewares: 
 *           controller: 
 *       }
 *   }
 *
 *   '<base path>': {    
 *       module: "controller"
 *   }
  */
module.exports = function (app, baseRoute, moduleItem) {
    let controllerPath = path.join(app.backendPath, Literal.CONTROLLERS_PATH);   

    if (typeof moduleItem === 'string') {
        // [ 'controllerName' ]
        moduleItem = {                
            controller: moduleItem
        };
    }    

    let currentPrefix = Util.urlJoin(baseRoute, moduleItem.route || '/');
    let router = currentPrefix === '/' ? new Router() : new Router({prefix: currentPrefix});
    

    if (moduleItem.middlewares) {            
        //module-wide middlewares       
        app.useMiddlewares(router, moduleItem.middlewares);
    } 

    let controllerFile = path.join(controllerPath, moduleItem.controller + '.js');
    let controller;

    controller = require(controllerFile);

    if (controller.prototype instanceof Controller) {
        controller = new controller(app);
    }
            
    for (let actionName in controller) {        
        let action = controller[actionName];    
        if (typeof action !== 'function') continue;

        let httpMethod = _.castArray(action.__metaHttpMethod || 'get');            
        let subRoute = Util.ensureLeftSlash(action.__metaRoute || actionName);

        _.each(httpMethod, method => {
            if (!Literal.ALLOWED_HTTP_METHODS.has(method)) {
                throw new InvalidConfiguration(
                    'Unsupported http method: ' + method,
                    app,
                    `routing.${baseRoute}.modules ${moduleItem.controller}.${actionName}`);
            }           

            app.addRoute(router, method, subRoute, action.__metaMiddlewares ? 
                action.__metaMiddlewares.concat([app.wrapAction(action)]) : 
                app.wrapAction(action));
        });
    };

    app.addRouter(router);
};
"use strict";

const path = require('path');
const Util = require('rk-utils');
const _ = Util._;
const Promise = Util.Promise;
const Controller = require('../patterns/controller');

const Router = require('koa-router');

/*
 '<base path>': {    
    module: {
        middlewares: 
        controller: 
    }
 }

 '<base path>': {    
    module: "controller"
 }
 */

module.exports = function (appModule, baseRoute, moduleItem) {
    let controllerPath = path.join(appModule.backendPath, Mowa.Literal.CONTROLLERS_PATH);   

    if (typeof moduleItem === 'string') {
        // [ 'controllerName' ]
        moduleItem = {                
            controller: moduleItem
        };
    }    

    let currentPrefix = Util.urlJoin(baseRoute, moduleItem.route || '');
    let router = currentPrefix === '/' ? new Router() : new Router({prefix: currentPrefix}), moduleBaseRoute;
    

    if (moduleItem.middlewares) {            
        //module-wide middlewares       
        appModule.useMiddlewares(router, moduleItem.middlewares);
    } 

    let controllerFile = path.join(controllerPath, moduleItem.controller + '.js');
    let controller;

    try {
        controller = require(controllerFile);
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Mowa.Error.InvalidConfiguration(
                `Controller "${controllerFile}" not found.`,
                appModule,
                `routing[${baseRoute}].module`
            );
        }

        throw error;
    }

    if (controller.prototype instanceof Controller) {
        controller = new controller(appModule);
    }
            
    for (let actionName in controller) {        
        let action = controller[actionName];    
        if (typeof action !== 'function') continue;

        let httpMethod = _.castArray(action.__metaHttpMethod || 'get');            
        let subRoute = Util.ensureLeftSlash(action.__metaRoute || actionName);

        _.each(httpMethod, method => {
            if (!Mowa.Literal.ALLOWED_HTTP_METHODS.has(method)) {
                throw new Mowa.Error.InvalidConfiguration(
                    'Unsupported http method: ' + method,
                    appModule,
                    `routing.${baseRoute}.modules ${moduleItem.controller}.${actionName}`);
            }           

            appModule.addRoute(router, method, subRoute, action.__metaMiddlewares ? action.__metaMiddlewares.concat([appModule.wrapAction(action)]) : appModule.wrapAction(action));
        });
    };

    appModule.addRouter(router);

    return Promise.resolve();
};
"use strict";

const path = require('path');
const Mowa = require('../server.js');
const Util = Mowa.Util;
const _ = Util._;
const Promise = Util.Promise;

const Router = require('koa-router');

/*
 '<base path>': {
     rest: {
         resources:
         middlewares:
     }
 }

 route                          http method    function of ctrl
 /:resource                      get            query
 /:resource                      post           create
 /:resource/:id                  get            get
 /:resource/:id                  put            update
 /:resource/:id                  delete         remove
 */

module.exports = async (appModule, baseRoute, options) => {
    let resourcePath = path.join(appModule.backendPath, Mowa.Literal.RESOURCES_PATH);
    
    let router = baseRoute === '/' ? new Router() : new Router({prefix: baseRoute});

    if (options.middlewares) {
        appModule.useMiddlewares(router, options.middlewares);
    }

    let ctrlsMap = new Map();

    let resourcesPath =  path.join(resourcePath, "*.js");
    let files = Util.glob.sync(resourcesPath, {nodir: true});

    _.each(files, file => {
        let urlName = Util._.snakeCase(path.basename(file, '.js'));
        ctrlsMap.set(urlName, require(file));
    });

    appModule.addRoute(router, 'get', '/:resource', { restAction: { type: 'query', controllers: ctrlsMap } });
    appModule.addRoute(router, 'post', '/:resource', { restAction: { type: 'create', controllers: ctrlsMap } });
    appModule.addRoute(router, 'get', '/:resource/:id', { restAction: { type: 'detail', controllers: ctrlsMap } });
    appModule.addRoute(router, 'put', '/:resource/:id', { restAction: { type: 'update', controllers: ctrlsMap } });
    appModule.addRoute(router, 'delete', '/:resource/:id', { restAction: { type: 'remove', controllers: ctrlsMap } });

    appModule.addRouter(router);
};
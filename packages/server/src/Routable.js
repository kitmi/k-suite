"use strict";

const path = require('path');
const { _, fs, glob, urlJoin, ensureLeftSlash, urlAppendQuery } = require('rk-utils');
const Errors = require('./Errors');
const Literal = require('./enum/Literal');
const Koa = require('koa');

const Routable = T => class extends T {    
    /**     
     * @param {string} name - The name of the routable instance.     
     * @param {object} [options] - Routable options     
     * @property {object} [options.logger] - Logger options
     * @property {bool} [options.verbose=false] - Flag to output trivial information for diagnostics        
     * @property {string} [options.env] - Environment, default to process.env.NODE_ENV
     * @property {string} [options.workingPath] - App's working path, default to process.cwd()
     * @property {string} [options.configPath] - App's config path, default to "conf" under workingPath     
     * @property {string} [options.backendPath='server'] - Relative path of back-end server source files
     * @property {string} [options.clientPath='client'] - Relative path of front-end client source files     
     * @property {string} [options.publicPath='public'] - Relative path of front-end static files 
     */         
    constructor(name, options) {
        super(name, options);

        /**
         * Backend files path.
         * @member {string}         
         **/
        this.backendPath = this.toAbsolutePath(this.options.backendPath || Literal.BACKEND_PATH);

        /**
         * Frontend source files path.
         * @member {string}
         **/
        this.clientPath = this.toAbsolutePath(this.options.clientPath || Literal.CLIENT_SRC_PATH);

        /**
         * Frontend static files path.
         * @member {string}
         **/
        this.publicPath = this.toAbsolutePath(this.options.publicPath || Literal.PUBLIC_PATH);

        /**
         * Each app has its own router.
         * @member {Koa}
         **/
        this.router = new Koa();
        this.router.use((ctx, next) => { ctx.appModule = this; return next(); });

        this.on('configLoaded', () => {
            //load middlewares if exists in server or app path
            let middlewareDir = this.toAbsolutePath(Literal.MIDDLEWARES_PATH);
            if (fs.existsSync(middlewareDir)) {
                this.loadMiddlewaresFrom(middlewareDir);
            }            
        });  
    }

    async start_() {
        /**
         * Middleware factory registry.
         * @member {object}
         */
        this.middlewareFactoryRegistry = {};

        return super.start_();
    }

    async stop_() {
        delete this.middlewareFactoryRegistry;

        return super.stop_();
    }

    /**
     * Load and regsiter middleware files from a specified path.
     * @param dir
     */
    loadMiddlewaresFrom(dir) {
        let files = glob.sync(path.join(dir, '*.js'), {nodir: true});
        files.forEach(file => this.registerMiddlewareFactory(path.basename(file, '.js'), require(file)));
    }

    /**
     * Register the factory method of a named middleware.     
     * @param {string} name - The name of the middleware 
     * @param {function} factoryMethod - The factory method of a middleware
     */
    registerMiddlewareFactory(name, factoryMethod) {
        pre: typeof factoryMethod === 'function', 'Invalid middleware factory: ' + name;

        if (name in this.middlewareFactoryRegistry) {
            throw new Errors.ServerError('Middleware "'+ name +'" already registered!');
        }

        this.middlewareFactoryRegistry[name] = factoryMethod;
        this.log('verbose', `Registered named middleware [${name}].`);
    }

    /**
     * Get the factory method of a middleware from module hierarchy.     
     * @param name
     * @returns {function}
     */
    getMiddlewareFactory(name) {
        if (this.middlewareFactoryRegistry.hasOwnProperty(name)) {
            return this.middlewareFactoryRegistry[name];
        }

        if (this.server) {
            return this.server.getMiddlewareFactory(name);
        }

        throw new Errors.ServerError(`Don't know where to load middleware "${name}".`);
    }

    /**
     * Use middlewares
     * @param {Router} router
     * @param {*} middlewares - Can be an array of middleware entries or a key-value list of registerred middlewares
     * @returns {RoutableApp}
     */
    useMiddlewares(router, middlewares) {
        let middlewareFactory, middleware;
        let middlewareFunctions = [];
        
        if (_.isPlainObject(middlewares)) {
            _.forOwn(middlewares, (options, name) => {
                middlewareFactory = this.getMiddlewareFactory(name);   
                middleware = middlewareFactory(options, this);
                middlewareFunctions.push({ name, middleware });                
            });
        } else {
            middlewares = _.castArray(middlewares);          
        
            _.each(middlewares, middlewareEntry => {
                let type = typeof middlewareEntry;

                if (type === 'string') {
                    // [ 'namedMiddleware' ]
                    middlewareFactory = this.getMiddlewareFactory(middlewareEntry);
                    middleware = middlewareFactory(null, this);
                    middlewareFunctions.push({ name: middlewareEntry , middleware });
                } else if (type === 'function') {
                    middlewareFunctions.push({ name: middlewareEntry.name || 'unamed middleware', middleware: middlewareEntry});
                } else {
                    assert: _.isPlainObject(middlewareEntry) && 'name' in middlewareEntry, 'Invalid middleware entry';

                    middlewareFactory = this.getMiddlewareFactory(middlewareEntry.name);
                    middleware = middlewareFactory(middlewareEntry.options, this);
                    middlewareFunctions.push({ name: middlewareEntry.name, middleware });
                }
            });
        } 
        
        middlewareFunctions.forEach(({ name, middleware }) => {            
            if (Array.isArray(middleware)) {
                middleware.forEach(m => this._useMiddleware(router, m));
            } else {
                this._useMiddleware(router, middleware);
            }

            this.log('verbose', `Attached middleware [${name}].`);
        });        

        return this;
    }

    /**
     * Add a route to a router, skipped while the server running in deaf mode.     
     * @param router
     * @param method
     * @param route
     * @param actions
     */
    addRoute(router, method, route, actions) {
        let handlers = [], middlewareFactory;

        if (_.isPlainObject(actions)) {
            _.forOwn(actions, (options, name) => {
                middlewareFactory = this.getMiddlewareFactory(name);
                handlers.push(middlewareFactory(options, this));
            });
        } else {
            actions = _.castArray(actions);

            _.each(actions, action => {
                let type = typeof action;
                if (type === 'string') {
                    // [ 'namedMiddleware' ]
                    middlewareFactory = this.getMiddlewareFactory(action);                    
                    handlers.push(middlewareFactory(null, this));
                } else if (type === 'function') {
                    handlers.push(action);
                } else {
                    assert: _.isPlainObject(action) && 'name' in action, 'Invalid middleware entry';

                    middlewareFactory = this.getMiddlewareFactory(action.name);                    
                    handlers.push(middlewareFactory(action.options, this));
                }
            })
        }

        router[method](route, ...handlers);

        let endpoint = router.opts.prefix ? urlJoin(this.route, router.opts.prefix, route) : urlJoin(this.route, route);

        this.log('verbose', `Route "${method}:${endpoint}" is added from module [${this.name}].`);

        return this;
    }    

    /**
     * Attach a router to this app module, skipped while the server running in deaf mode     
     * @param {Router} nestedRouter
     */
    addRouter(nestedRouter) {
        this.router.use(nestedRouter.routes());
        this.router.use(nestedRouter.allowedMethods());
        return this;
    }

    /**
     * Translate a relative path and query parameters if any to a url path     
     * @param {string} relativePath - Relative path
     * @param {...*} [pathOrQuery] - Queries
     * @returns {string}
     */
    toWebPath(relativePath, ...pathOrQuery) {
        let url, query;

        if (pathOrQuery && pathOrQuery.length > 0 && (pathOrQuery.length > 1 || pathOrQuery[0] !== undefined)) {
            if (_.isObject(pathOrQuery[pathOrQuery.length - 1])) {
                query = pathOrQuery.pop();
            }
            pathOrQuery.unshift(relativePath);
            url = urlJoin(this.route, ...pathOrQuery);
        } else {
            url = urlJoin(this.route, relativePath);
        }

        url = ensureLeftSlash(url);
        if (query) {
            url = urlAppendQuery(url, query);
            url = url.replace('/?', '?');
        }

        return url;
    }

    /**
     * Prepare context for koa action
     * @param {Object} ctx - Koa request context
     * @param {function} action - Action function
     * @return {function}
     */
    wrapAction(action) {
        return async (ctx) => {
            Object.assign(ctx.state, {
                _self: ctx.originalUrl || this.toWebPath(ctx.url),
                __: ctx.__,
                _makePath: (relativePath, query) => this.toWebPath(relativePath, query),
                _makeUrl: (relativePath, query) => (ctx.origin + this.toWebPath(relativePath, query))            
            });

            if (ctx.csrf) {            
                ctx.state._csrf = ctx.csrf;
            }

            return action(ctx);
        };        
    }       

    _useMiddleware(router, middleware) {        
        router.use(middleware);
    }

    _getFeatureFallbackPath() {
        return super._getFeatureFallbackPath().concat([ this.toAbsolutePath(Literal.BACKEND_PATH, Literal.FEATURES_PATH) ]);
    }
};

module.exports = Routable;
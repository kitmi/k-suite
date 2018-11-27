"use strict";

/**
 * Session middleware
 * @module Middleware_Session
 */

const Util = require('rk-utils');
const session = require('koa-session-mowa');
const { InvalidConfiguration } = require('../Errors');

const DEFAULT_OPTS = {
    key: 'k-server.sid',
    prefix: 'k-server:sess:'
};

/**
 * Initialize session middleware
 * @param {object} options - Session options 
 * @property {string} [options.key='mowa:sid'] - Cookie name defaulting to mowa.sid 
 * @property {string} [options.prefix='mowa:sess:'] - Session prefix for store, defaulting to mowa:sess:
 * @property {number} [options.maxAge] - SessionStore's expiration time (ms), defaulting to 86400000 (1 day)
 * @property {bool} [options.autoCommit=true] - Automatically commit headers (default true)
 * @property {bool} [options.overwrite=true] - Can overwrite or not (default true) 
 * @property {bool} [options.httpOnly=true] - HttpOnly or not (default true)
 * @property {bool} [options.signed=true] - Signed or not
 * @property {bool} [options.rolling=false] - Force a session identifier cookie to be set on every response. The expiration is reset to the original maxAge, resetting the expiration countdown. (default is false) 
 * @property {bool} [options.renew=false] - Renew session when session is nearly expired, so we can always keep user logged in. (default is false)
 * @property {function} [options.genSid] - The way of generating external session id is controlled by the options.genid, which defaults to Date.now() + '-' + uid.sync(24)
 * @property {function} [options.valid] - valid(ctx, session), valid session value before use it
 * @property {function} [options.beforeSave] - beforeSave(ctx, session), hook before save session
 * @property {object} [options.store] - Session store instance. It can be any Object that has the methods set, get, destroy like MemoryStore.
 * @param {Routable} app 
 */
module.exports = (options, app) => {

    let store = options.store || { type: 'memory' };

    if (!store.type) {
        throw new InvalidConfiguration(
            'Missing session store type.',
            app,
            'middlewares.session.store'
        );        
    }

    let storeObject;

    switch (store.type) {
        case 'redis':
            storeObject = require('koa-redis')(store.options);
            break;
        case 'mysql':
            storeObject = require('koa-mysql-session')(store.options);
            break;
        case 'mongodb':
            storeObject = require('koa-generic-session-mongo')(store.options);
            break;
        case 'pgsql':
            storeObject = require('koa-pg-session')(store.options);
            break;
        case 'sqlite3':
            storeObject = require('koa-sqlite3-session')(store.options);
            break;
        case 'memory':
            const MemoryStore = require('koa-session-memory');
            storeObject = new MemoryStore();
            break;
        default:
            throw new Mowa.Error.InvalidConfiguration(
                'Unsupported session store type: ' + store.type,
                app,
                'middlewares.session.store.type'
            );
    }

    let sessionOptions = Object.assign({}, DEFAULT_OPTS, options, {store: storeObject});

    return session(sessionOptions);
};
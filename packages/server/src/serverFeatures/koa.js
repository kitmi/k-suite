"use strict";

const Feature = require('@k-suite/cli-app/lib/enum/Feature');
const Util = require('rk-utils');
const _ = Util._;
const Promise = Util.Promise;
const { Convertors } = require('../oolong/runtime');
const { InvalidConfiguration } = require('../Errors');

/**
 * Koa middleware function
 * @callback KoaActionFunction
 * @async
 * @param {object} ctx - The koa request and response context. [See koajs about ctx details]{@link http://koajs.com/#context}
 * @property {object} ctx.reqeust - The koa request object.
 * @property {object} ctx.response - The koa response object.
 * @param {KoaActionFunction} [next] - Next middleware or action.
 */

/**
 * Enable koa-based web engine.
 * @module Feature_Koa 
 */

module.exports = {

    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.SERVICE,

    /**
     * Load the feature
     * @param {WebServer} server - The web server
     * @param {object} options - Options for the feature     
     * @property {bool} [options.trustProxy] - When true proxy header fields will be trusted
     * @property {Array.<string>} [options.keys] - Set signed cookie keys
     * @property {int} [options.httpPort] - The http port number
     * @property {int} [options.subdomainOffset=2] - The offset of subdomains to ignore, default: 2
     * @returns {Promise.<*>}
     */
    load_: function (server, options) {
        let koa = server.router;
        
        koa.env = server.env;
        koa.proxy = options.trustProxy && Convertors.toBoolean(options.trustProxy);

        if (('subdomainOffset' in options) && options.subdomainOffset !== 2) {
            if (options.subdomainOffset < 2) {
                throw new InvalidConfiguration(
                    'Invalid subdomainOffset. Should be larger or equal to 2.',
                    appModule,
                    'koa.subdomainOffset'
                );
            }

            koa.subdomainOffset = options.subdomainOffset;
        }

        if (options.keys) {
            if (!_.isArray(options.keys)) {
                koa.keys = [ options.keys ];
            } else {
                koa.keys = options.keys;
            }
        }

        koa.on('error', (err, ctx) => {
            if (err.status && err.status < 500) {
                server.log('warn', `[${err.status}] ` + err.message, ctx && _.pick(ctx, ['method', 'url', 'ip']));
            } else {
                server.log('error', err.message, { status: err.status, stack: err.stack });
            }
        });        
        
        server.engine = koa;
        server.httpServer = require('http').createServer(koa.callback());        

        let port = options.httpPort || 2331;

        server.on('ready', () => {
            
            server.httpServer.listen(port, function (err) {
                if (err) throw err;

                server.log('info', `A http service is listening on port [${server.httpServer.address().port}] ...`);
                /**
                 * Http server ready event
                 * @event WebServer#httpReady
                 */
                server.emit('httpReady');
            });
        });
    }
};
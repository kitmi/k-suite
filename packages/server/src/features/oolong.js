"use strict";

/**
 * @module Feature_Oolong
 * @summary Enable oolong DSL
 */

const path = require('path');
const Mowa = require('../server.js');
const Feature = require('../enum/feature');
const Util = Mowa.Util;
const Promise = Util.Promise;

module.exports = {
    /**
     * This feature is loaded at init stage
     * @member {string}
     */
    type: Feature.INIT,

    /**
     * Load the feature
     * @param {AppModule} appModule - The app module object
     * @param {object} oolong - Oolong settings
     * @property {bool} [oolong.logSqlStatement] - Flag to turn on sql debugging log
     * @returns {Promise.<*>}
     */
    load_: async (appModule, oolong) => {
        appModule.oolong = oolong;
        
        appModule.on('after:' + Feature.MIDDLEWARE, () => {
            if (!appModule.hasPostActions) {
                appModule.useMiddlewares(appModule.router, 'postActions');                
            } 
        });

        appModule.on('after:' + Feature.DBMS, () => {

            appModule.db = function (dbServiceId, ctx) {
                if (!dbServiceId) {
                    throw new Error('"dbServiceId" is required!');
                }

                if (ctx && ctx.db && (dbServiceId in ctx.db)) {
                    return ctx.db[dbServiceId];
                }

                let [ dbType, dbName ] = dbServiceId.split(':');

                let dbFile = path.resolve(appModule.backendPath, Mowa.Literal.MODELS_PATH, dbType, dbName + '.js');
                let Dao = require(dbFile);
                let dao = new Dao(appModule, ctx);
                
                if (ctx) {
                    ctx.db || (ctx.db = {});
                    ctx.db[dbServiceId] = dao;
                }
                
                return dao;
            };
        });
    }
};
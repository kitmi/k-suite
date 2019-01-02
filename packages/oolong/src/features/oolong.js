"use strict";

/**
 * Enable oolong DSL
 * @module Feature_Oolong
 */

const path = require('path');
const { _, Promise } = require('rk-utils');
const Feature = require('@k-suite/app/lib/Feature');

module.exports = {
    /**
     * This feature is loaded at init stage
     * @member {string}
     */
    type: Feature.INIT,

    /**
     * Load the feature
     * @param {App} app - The app module object
     * @param {object} oolong - Oolong settings
     * @property {bool} [oolong.logSqlStatement] - Flag to turn on sql debugging log
     * @returns {Promise.<*>}
     */
    load_: async (app, oolong) => {
        app.oolong = oolong;
        
        app.on('after:' + Feature.MIDDLEWARE, () => {
            if (!app.hasPostActions) {
                app.useMiddlewares(app.router, 'postActions');                
            } 
        });

        app.on('after:' + Feature.DBMS, () => {

            app.db = function (schemaName) {
                if (!dbServiceId) {
                    throw new Error('"dbServiceId" is required!');
                }

                if (ctx && ctx.db && (dbServiceId in ctx.db)) {
                    return ctx.db[dbServiceId];
                }

                let [ dbType, dbName ] = dbServiceId.split(':');

                let dbFile = path.resolve(app.backendPath, Mowa.Literal.MODELS_PATH, dbType, dbName + '.js');
                let Dao = require(dbFile);
                let dao = new Dao(app, ctx);
                
                if (ctx) {
                    ctx.db || (ctx.db = {});
                    ctx.db[dbServiceId] = dao;
                }
                
                return dao;
            };
        });
    }
};
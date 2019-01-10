"use strict";

/**
 * Enable oolong DSL
 * @module Feature_Oolong
 */

const path = require('path');
const { _, Promise, pascalCase, eachAsync_ } = require('rk-utils');
const { Feature, Literal } = require('..').enum;
const { InvalidConfiguration } = require('../Errors');

const DbCache = {};

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

        if (!oolong.schemaDeployment) {
            throw new InvalidConfiguration(
                `Missing "schemaDeployment" in oolong config.`,
                app,
                'oolong.schemaDeployment'
            );
        }

        app.db = (schemaName) => {
            if (DbCache[schemaName]) return DbCache[schemaName];
            
            let schemaInfo = oolong.schemaDeployment[schemaName];
            if (!schemaInfo || !schemaInfo.dataSource) {
                throw new InvalidConfiguration(
                    `Missing "dataSource" in schemaDeployment section of oolong config.`,
                    app,
                    `oolong.schemaDeployment.${schemaName}.dataSource`
                );
            }

            let connector = app.getService(schemaInfo.dataSource);
            if (!connector) {
                throw new InvalidConfiguration(
                    `Invalid data source.`,
                    app,
                    schemaInfo.dataSource
                );
            }

            let i18n = app.getService('i18n') || app.__;

            const Db = require(path.join(app.backendPath, Literal.MODELS_PATH, pascalCase(schemaName)));
            let db = new Db(connector, i18n);
            DbCache[schemaName] = db;

            return db;
        }        
    }
};
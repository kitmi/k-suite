"use strict";

const path = require('path');

const Mowa = require('../server.js');
const Util = require('../util.js');
const fs = Util.fs;
const _ = Util._;
const Linker = require('./lang/linker.js');

/**
 * @module Oolong
 * @summary Oolong DSL lib
 */

function prepareLinkerContext(context, schemaFile) {
    let oolongConfig = context.currentApp.config.oolong;

    if (!oolongConfig) {
        return new Error('Missing oolong config in app module "' + context.currentApp.name + '".');
    }

    if (!oolongConfig.schemas) {
        throw new Error('No schemas configured in oolong config.');
    }

    let linker = new Linker(context);
    linker.link(schemaFile);

    if (!linker.schema) {
        throw new Error('No schema found in the linker.');
    }

    context.linker = linker;

    return oolongConfig;
}

/**
 * Build database scripts from oolong files
 * @param {object} context
 * @property {Logger} context.logger - Logger object
 * @property {AppModule} context.currentApp - Current app module
 * @property {bool} context.verbose - Verbose mode
 * @param {string} schemaFile
 * @param {string} [restify]
 * @returns {Promise}
 */
exports.build = function (context, schemaFile, restify) {
    let oolongConfig = prepareLinkerContext(context, schemaFile);

    let buildPath = context.currentApp.toAbsolutePath(Mowa.Literal.DB_SCRIPTS_PATH);
    
    let schemaDeployments = [];

    if (!oolongConfig.schemas) {
        throw new Error('Schemas config not found! Try run "mowa ooloon config" first.');
    }
    
    let schema = context.linker.schema;
    let schemaName = schema.name;

    if (!(schemaName in oolongConfig.schemas)) {
        throw new Error('Schema "' + schemaName + '" not exist in oolong config.');
    }

    let schemaOolongConfig = oolongConfig.schemas[schemaName];
    let deployment = _.isArray(schemaOolongConfig.deployTo) ? schemaOolongConfig.deployTo : [ schemaOolongConfig.deployTo ];

    _.each(deployment, dbServiceKey => {
        let service = context.currentApp.getService(dbServiceKey);
        assert: service, Util.Message.DBC_VAR_NOT_NULL;

        let dbmsOptions = Object.assign({}, service.dbmsSpec);

        let DbModeler = require(`./modeler/db/${service.dbType}.js`);
        let dbModeler = new DbModeler(context, dbmsOptions);

        schemaDeployments.push(dbModeler.modeling(service, schema, buildPath));
    });

    const DaoModeler = require('./modeler/dao.js');
    let daoModeler = new DaoModeler(context, context.currentApp.toAbsolutePath(Mowa.Literal.BACKEND_SRC_PATH, Mowa.Literal.MODELS_PATH));

    _.each(schemaDeployments, schema => {
        let schemaOolongConfig = oolongConfig.schemas[schema.name];
        assert: schemaOolongConfig, Util.Message.DBC_VAR_NOT_NULL;

        let deployment = _.isArray(schemaOolongConfig.deployTo) ? schemaOolongConfig.deployTo : [ schemaOolongConfig.deployTo ];

        _.each(deployment, dbServiceKey => {
            let service = context.currentApp.getService(dbServiceKey);

            daoModeler.modeling(schema, service);
        });
    });
    
    if (restify) {
        const RestifyModeler = require('./modeler/restify.js');
        let restifyModeler = new RestifyModeler(context, path.resolve(context.currentApp.backendPath, Mowa.Literal.RESOURCES_PATH));

        let service = context.currentApp.getService(restify);

        restifyModeler.modeling(schema, service);
    }
};

/**
 * Deploy database
 * @param {object} context
 * @property {Logger} context.logger - Logger object
 * @property {AppModule} context.currentApp - Current app module
 * @property {bool} context.verbose - Verbose mode
 * @param {string} schemaFile
 * @param {bool} reset
 * @returns {Promise}
 */
exports.deploy = function (context, schemaFile, reset = false) {
    let oolongConfig = prepareLinkerContext(context, schemaFile);

    let promises = [];

    let schema = context.linker.schema;
    let schemaName = schema.name;

    if (!(schemaName in oolongConfig.schemas)) {
        throw new Error('Schema "' + schemaName + '" not exist in oolong config.');
    }

    let schemaOolongConfig = oolongConfig.schemas[schemaName];
    let deployment = _.isArray(schemaOolongConfig.deployTo) ? schemaOolongConfig.deployTo : [ schemaOolongConfig.deployTo ];

    _.each(deployment, (dbServiceKey) => {
        let service = context.currentApp.getService(dbServiceKey);

        let Deployer = require(`./deployer/db/${service.dbType}.js`);
        let deployer = new Deployer(context, service);

        promises.push(() => deployer.deploy(reset));
    });

    return Util.eachPromise_(promises);
};

/**
 * Import a data set into database
 * @param {object} context
 * @property {Logger} context.logger - Logger object
 * @property {AppModule} context.currentApp - Current app module
 * @property {bool} context.verbose - Verbose mode
 * @param {string} db
 * @param {string} dataSetDir
 * @returns {Promise}
 */
exports.import = async (context, db, dataSetDir) => {
    let [ dbType, ] = db.split(':');

    let dataListFile = path.join(dataSetDir, 'index.list');

    if (!fs.existsSync(dataListFile)) {
        return Promise.reject(`Data entry list file "${dataListFile}" not found.`);
    }

    let dataList = fs.readFileSync(dataListFile).toString().match(/^.+$/gm);
    let Deployer = require(`./deployer/db/${dbType}.js`);
    let service = context.currentApp.getService(db);
    let deployer = new Deployer(context, service);

    return Util.eachAsync_(dataList, async line => {
        line = line.trim();

        if (line.length > 0) {
            let dataFile = path.join(dataSetDir, line);
            if (!fs.existsSync(dataFile)) {
                return Promise.reject(`Data file "${dataFile}" not found.`);
            }

            await deployer.loadData(dataFile);
        }
    });
};

/**
 * Extract database structure into oolong dsl
 * @param {object} context
 * @property {Logger} context.logger - Logger object
 * @property {AppModule} context.currentApp - Current app module
 * @property {bool} context.verbose - Verbose mode
 * @property {bool} context.removeTablePrefix - Whether to remove table prefix
 * @param {string} db
 * @param {string} extractedOolPath
 * @returns {Promise}
 */
exports.reverse = async (context, db, extractedOolPath) => {

    let service = context.currentApp.getService(db);
    let dbmsOptions = Object.assign({}, service.dbmsSpec);

    let DbModeler = require(`./modeler/db/${service.dbType}.js`);
    let dbModeler = new DbModeler(context, dbmsOptions);

    return dbModeler.extract(service, extractedOolPath, context.removeTablePrefix);
};

exports.Linker = Linker;
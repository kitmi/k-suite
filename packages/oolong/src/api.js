"use strict";

const path = require('path');

const Util = require('rk-utils');
const { _, fs, eachAsync_ } = Util;

const Linker = require('./lang/Linker');

/**
 * Oolong DSL api
 * @module Oolong
 */

function createLinker(context, schemaFile) {
    let linker = new Linker(context);
    linker.link(schemaFile);

    if (_.isEmpty(linker.schemas)) {
        throw new Error(`Schema information not found in "${schemaFile}".`);
    }

    return linker;
}

/**
 * Build database scripts from oolong files
 * @param {object} context
 * @property {Logger} context.logger - Logger object
 * @property {string} context.sourcePath
 * @property {string} context.modelOutputPath  
 * @property {bool} context.useJsonSource
 * @property {object} context.modelMapping   
 * @returns {Promise}
 */
exports.buildModels_ = async (context) => {
    context.logger.log('verbose', 'Start building models ...');

    let schemaFiles = Linker.getOolongFiles(context.sourcePath, context.useJsonSource);

    return eachAsync_(schemaFiles, async schemaFile => {
        let linker = createLinker(context, schemaFile);

        return eachAsync_(linker.schemas, (schema, schemaName) => {
            let modelMapping = context.modelMapping[schemaName];

            if (!modelMapping) {
                context.logger.log('warn', `Schema "${schemaName}" has no data source mapping and is ignored in modeling.`);
                return;
            }

            const DaoModeler = require('./modeler/Dao');
            let daoModeler = new DaoModeler({ logger: context.logger, schema, modelMapping, outputPath: context.modelOutputPath });

            return daoModeler.modeling_();
        });        
    });    
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
    let oolongConfig = createLinker(context, schemaFile);

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
 * @property {Connector} context.connector
 * @property {Logger} context.logger 
 * @param {string} outputPath - Absolute output path.
 * @returns {Promise}
 */
exports.reverse_ = async (context, outputPath) => {       
    let ReserveEngineering = require(`./modeler/database/${context.connector.driver}/ReverseEngineering`);
    let modeler = new ReserveEngineering(context);

    return modeler.reverse_(outputPath);
};
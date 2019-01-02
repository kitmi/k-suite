"use strict";

const path = require('path');

const Util = require('rk-utils');
const { _, fs, eachAsync_ } = Util;

const Linker = require('./Linker');
const Connector = require('../runtime/Connector');

/**
 * Oolong DSL api
 * @module Oolong
 */

 function createConnector(context, schemaName) {
    let deployment = context.schemaDeployment[schemaName];

    if (!deployment) {
        context.logger.log('warn', `Schema "${schemaName}" has no configured deployment and is ignored in modeling.`);
        return;
    }

    let { dataSource, connectionString, options } = deployment;
    let [ driver ] = dataSource.split('.');

    return Connector.createConnector(driver, connectionString, { logger: context.logger, ...options });       
 }

 async function importDataFiles(migrator, folderName) {
    let dataSetPath = path.join(migrator.dbScriptPath, 'data', folderName);
    let dataListFile = path.join(dataSetPath, 'index.list');

    if (!fs.existsSync(dataListFile)) {
        return;
    }

    let dataList = fs.readFileSync(dataListFile).toString().match(/^.+$/gm);

    return eachAsync_(dataList, async line => {
        line = line.trim();

        if (line.length > 0) {
            let dataFile = path.join(dataSetPath, line);
            if (!fs.existsSync(dataFile)) {
                return Promise.reject(`Data file "${dataFile}" not found.`);
            }

            await migrator.load_(dataFile);
        }
    });
 }

/**
 * Build database scripts and entity models from oolong files.
 * @param {object} context
 * @property {Logger} context.logger - Logger object
 * @property {string} context.dslSourcePath
 * @property {string} context.modelOutputPath         
 * @property {string} context.scriptOutputPath
 * @property {bool} context.useJsonSource
 * @property {object} context.schemaDeployment   
 * @returns {Promise}
 */
exports.build_ = async (context) => {
    context.logger.log('verbose', 'Start building models ...');

    let linker = new Linker(context);
    context.linker = linker;

    let schemaFiles = Linker.getOolongFiles(context.dslSourcePath, context.useJsonSource);
    schemaFiles.forEach(schemaFile => linker.link(schemaFile));    

    return eachAsync_(linker.schemas, async (schema, schemaName) => {        
        let connector = createConnector(context, schemaName);
        assert: connector;

        try {
            let DbModeler = require(`../modeler/database/${connector.driver}/Modeler`);
            let dbModeler = new DbModeler(context, connector);
            let refinedSchema = dbModeler.modeling(schema);

            const DaoModeler = require('../modeler/Dao');
            let daoModeler = new DaoModeler(context, connector);

            await daoModeler.modeling_(refinedSchema);
        } catch (error) {
            throw error;
        } finally {
            await connector.end_();
        } 
    });            
};

/**
 * Deploy database scripts into database.
 * @param {object} context
 * @property {Logger} context.logger - Logger object
 * @property {string} context.modelPath
 * @property {string} context.dslSourcePath 
 * @property {string} context.scriptSourcePath 
 * @property {object} context.schemaDeployment   
 * @param {bool} reset
 * @returns {Promise}
 */
exports.migrate_ = async (context, reset = false) => {
    context.logger.log('verbose', 'Start deploying models ...');

    return eachAsync_(context.schemaDeployment, async (deployment, schemaName) => {
        let connector = createConnector(context, schemaName);
        assert: connector;

        try {
            let Migration = require(`../migration/${connector.driver}`);
            let migration = new Migration(context, schemaName, connector);

            if (reset) {
                await migration.reset_();
            }

            await migration.create_();

            await importDataFiles(migration, '_init');            
        } catch (error) {
            throw error;
        } finally {
            await connector.end_();
        } 
    });
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
    let Deployer = require(`../deployer/db/${dbType}.js`);
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
 * @property {string} context.dslReverseOutputDir 
 * @property {string} context.driver
 * @property {object} context.connOptions 
 * @returns {Promise}
 */
exports.reverse_ = async (context) => {   
    let ReserveEngineering = require(`../modeler/database/${context.driver}/ReverseEngineering`);
    
    let { connection: connectionString, ...options } = context.connOptions;  
    let connector = Connector.createConnector(context.driver, connectionString, { logger: context.logger, ...options });     
    assert: connector;  

    try {
        let modeler = new ReserveEngineering(context, connector);

        await modeler.reverse_(context.dslReverseOutputDir);
    } catch (error) {
        throw error;
    } finally {
        await connector.end_();
    } 
};
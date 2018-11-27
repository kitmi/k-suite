"use strict";

const Util = require('rk-utils');
const { _, fs } = Util;
const { extractDriverAndConnectorName } = require('../utils/lang');
const Connector = require('../runtime/Connector');

exports.commands = {
    'list': 'List all oolong schemas.',
    'create': 'Create database schema.',
    'config': 'Enable oolong feature and add deploy config.',
    'model': 'Generate entity models.',
    'deploy': 'Create database structure.',
    'dataset': 'List available data set.',
    'import': 'Import data set.',
    'reverse': 'Reverse engineering from a databse.'
};

/**
 * @param {OolongCore} core - OolongCore object.
 */
exports.options = (core) => {
    let cmdOptions = {};

    switch (core.command) {
        case 'list':
            cmdOptions['app'] = {
                desc: 'The name of the app to operate',
                required: true,
                inquire: true,
                promptType: 'list',
                choicesProvider: () => Promise.resolve(MowaHelper.getAvailableAppNames(core))
            };
            break;

        case 'create':
            cmdOptions['app'] = {
                desc: 'The name of the app to operate',
                inquire: true,
                promptType: 'list',
                choicesProvider: () => Promise.resolve(MowaHelper.getAvailableAppNames(core))
            };
            cmdOptions['schema'] = {
                desc: 'Specify the schema name of the database',
                alias: [ 's' ],
                required: true,
                inquire: true
            };
            break;

        case 'config':
            cmdOptions['app'] = {
                desc: 'The name of the app to operate',
                inquire: true,
                required: true,
                promptType: 'list',
                choicesProvider: () => Promise.resolve(MowaHelper.getAvailableAppNames(core))
            };
            cmdOptions['schema'] = {
                desc: 'The name of the schema',
                promptMessage: 'Please select the target schema:',
                alias: [ 's' ],
                required: true,
                inquire: true,
                promptType: 'list',
                choicesProvider: () => Promise.resolve(MowaHelper.getAppSchemas(core))
            };
            cmdOptions['db'] = {
                desc: 'The name of the db to be deployed',
                promptMessage: 'Please select the target db:',
                alias: [ 'database' ],
                required: true,
                inquire: true,
                promptType: 'list',
                choicesProvider: () => {
                    let conns = MowaHelper.getAppDbConnections(core);
                    if (_.isEmpty(conns)) {
                        throw new Error('Database connections not found. Config database connection first or run "mowa db add" first.');
                    }
                    return conns;
                }
            };
            break;

        case 'deploy':
            cmdOptions['app'] = {
                desc: 'The name of the app to operate',
                inquire: true,
                promptType: 'list',
                choicesProvider: () => Promise.resolve(MowaHelper.getAvailableAppNames(core))
            };
            cmdOptions['r'] = {
                desc: 'Reset all data if the database exists',
                required: true,
                alias: [ 'reset' ],
                bool: true,
                inquire: true
            };
            break;

        case 'model':
            cmdOptions['c'] = {
                desc: "Oolong config file",
                alias: [ "conf", "config" ],                
                inquire: true,
                promptMessage: 'Please input the config file path:',
                promptDefault: "conf/oolong.json"
            };  
            break;

        case 'dataset':
            cmdOptions['app'] = {
                desc: 'The name of the app to operate',
                promptMessage: 'Please select the target app:',
                inquire: true,
                promptType: 'list',
                choicesProvider: () => MowaHelper.getAvailableAppNames(core)
            };
            cmdOptions['db'] = {
                desc: 'The name of the db to operate',
                promptMessage: 'Please select the target db:',
                inquire: true,
                promptType: 'list',
                choicesProvider: () => MowaHelper.getAppDbConnections(core)
            };
            break;

        case 'import':
            cmdOptions['app'] = {
                desc: 'The name of the app to operate',
                promptMessage: 'Please select the target app:',
                inquire: true,
                promptType: 'list',
                choicesProvider: () => MowaHelper.getAvailableAppNames(core)
            };
            cmdOptions['db'] = {
                desc: 'The name of the db to operate',
                promptMessage: 'Please select the target db:',
                inquire: true,
                promptType: 'list',
                choicesProvider: () => MowaHelper.getAppDbConnections(core)
            };
            cmdOptions['dataSet'] = {
                desc: 'The name of the data set to import',
                promptMessage: 'Please select the target data set:',
                alias: [ 'ds', 'data' ],
                inquire: true,
                promptType: 'list',
                choicesProvider: () => listAvailableDataSet(core, core.getOption('db'))
            };
            break;

        case 'reverse':        
            let connectionStrings;

            cmdOptions['c'] = {
                desc: "Oolong config file",
                alias: [ "conf", "config" ],                
                inquire: true,
                promptMessage: 'Please input the config file path:',
                promptDefault: "conf/oolong.json",
                afterInquire: () => { connectionStrings = core.getConnectionStrings(core.option('c')); }
            };    

            cmdOptions['conn'] = {
                desc: 'The data source connector',
                alias: [ 'connector' ],
                promptMessage: 'Please select the data source connector:',
                inquire: true,
                promptType: 'list',
                choicesProvider: () => Object.keys(connectionStrings),
                afterInquire: () => { console.log('The conenction string of selected connector:', connectionStrings[core.option('conn')]); }                
            };
            break;
        
        default:
            //module general options
            break;
    }

    return cmdOptions;
};

exports.main = (core) => {
    if (core.option('v')) {
        console.log('v' + core.app.version);
    } else {
        core.showUsage();
    }
};

exports.model = async (core) => {
    core.app.log('verbose', 'oolong model');

    let oolongConfig = core.oolongConfig;

    let sourceDir = Util.getValueByPath(oolongConfig, 'oolong.sourceDir');
    if (!sourceDir) {
        throw new Error('"oolong.sourceDir" not found in oolong config.');
    }

    let modelOutputDir = Util.getValueByPath(oolongConfig, 'oolong.modelOutputDir');
    if (!modelOutputDir) {
        throw new Error('"oolong.modelOutputDir" not found in oolong config.');
    }

    let sourcePath = core.app.toAbsolutePath(sourceDir);    
    let modelOutputPath = core.app.toAbsolutePath(modelOutputDir);

    if (!fs.existsSync(sourcePath)) {
        return Promise.reject(`Source directory "${sourcePath}" not found.`);
    }

    let useJsonSource = Util.getValueByPath(oolongConfig, 'oolong.useJsonSource', false);
    let modelMapping = Util.getValueByPath(oolongConfig, 'oolong.modelMapping');

    if (_.isEmpty(modelMapping)) {
        throw new Error('"modelMapping" is empty.');
    }    

    modelMapping = _.mapValues(modelMapping, (mapping, schemaName) => {
        let { dataSource, ...others } = mapping;

        if (!dataSource) {
            throw new Error(`Configuration item "modelMapping.${schemaName}.dataSource" not found.`);
        }

        let connOptions = Util.getValueByPath(oolongConfig, dataSource);
        if (!connOptions) {
            throw new Error(`Data source config "${dataSource}" not found.`);
        }

        return { dataSource, connOptions, ...others };
    });

    return core.api.buildModels_({
        logger: core.app.logger,
        sourcePath,
        modelOutputPath,
        useJsonSource,
        modelMapping
    });
};

exports.reverse = async (core) => {
    core.app.log('verbose', 'oolong reverse');

    let oolongConfig = core.oolongConfig;

    let reverseOutputDir = Util.getValueByPath(oolongConfig, 'oolong.reverseOutputDir');
    if (!reverseOutputDir) {
        throw new Error('"oolong.reverseOutputDir" not found in oolong config.');
    }

    let outputDir = core.getReverseOutputDir(core.app.toAbsolutePath(reverseOutputDir));

    //todo: relocation, and deep copy connection options
    let conn = core.option('conn');
    let [ driver, connectorName ] = extractDriverAndConnectorName(conn);
    let connOptions = Util.getValueByPath(oolongConfig, driver + '.' + connectorName);
    assert: connOptions;    

    if (typeof connOptions.reverseRules === 'string') {
        connOptions.reverseRules = require(core.app.toAbsolutePath(connOptions.reverseRules));
    } 

    assert: !connOptions.reverseRules || _.isPlainObject(connOptions.reverseRules);

    connOptions.logger = core.app.logger;

    let connector = Connector.createConnector(driver, connectorName, connOptions);

    try {                
        await core.api.reverse_({ connector, logger: core.app.logger }, outputDir);
    } catch (error) {
        throw error;
    } finally {
        await connector.end_();
    }    
};
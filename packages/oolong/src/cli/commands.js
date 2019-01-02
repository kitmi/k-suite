"use strict";

const Util = require('rk-utils');
const { _, fs } = Util;
const { extractDriverAndConnectorName } = require('../utils/lang');

exports.commands = {
    'list': 'List all oolong schemas.',
    'create': 'Create database schema.',
    'config': 'Enable oolong feature and add deploy config.',
    'build': 'Generate database scripts and entity models.',
    'migrate': 'Create database structure.',
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

        case 'migrate':
            cmdOptions['c'] = {
                desc: "Oolong config file",
                alias: [ "conf", "config" ],                
                inquire: true,
                promptMessage: 'Please input the config file path:',
                promptDefault: "conf/oolong.json"
            };  
            cmdOptions['r'] = {
                desc: 'Reset all data if the database exists',
                promptMessage: 'Reset existing database?',
                promptDefault: false,
                inquire: true,
                required: true,
                alias: [ 'reset' ],
                isBool: true
            };
            break;

        case 'build':
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
                required: true,
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

exports.build = async (core) => {
    core.app.log('verbose', 'oolong model');

    let oolongConfig = core.oolongConfig;

    let dslSourceDir = Util.getValueByPath(oolongConfig, 'oolong.dslSourceDir');
    if (!dslSourceDir) {
        throw new Error('"oolong.dslSourceDir" not found in oolong config.');
    }

    let modelOutputDir = Util.getValueByPath(oolongConfig, 'oolong.modelOutputDir');
    if (!modelOutputDir) {
        throw new Error('"oolong.modelOutputDir" not found in oolong config.');
    }

    let scriptOutputDir = Util.getValueByPath(oolongConfig, 'oolong.scriptOutputDir');
    if (!scriptOutputDir) {
        throw new Error('"oolong.scriptOutputDir" not found in oolong config.');
    }

    let dslSourcePath = core.app.toAbsolutePath(dslSourceDir);    
    let modelOutputPath = core.app.toAbsolutePath(modelOutputDir);
    let scriptOutputPath = core.app.toAbsolutePath(scriptOutputDir);

    if (!fs.existsSync(dslSourcePath)) {
        return Promise.reject(`DSL source directory "${dslSourcePath}" not found.`);
    }

    let useJsonSource = Util.getValueByPath(oolongConfig, 'oolong.useJsonSource', false);       
    let saveIntermediate = Util.getValueByPath(oolongConfig, 'oolong.saveIntermediate', false);       

    return core.api.build_({
        logger: core.app.logger,
        dslSourcePath,
        modelOutputPath,
        scriptOutputPath,
        useJsonSource,
        saveIntermediate,
        schemaDeployment: core.schemaDeployment
    });
};

exports.migrate = async (core) => {
    core.app.log('verbose', 'oolong deploy');

    let oolongConfig = core.oolongConfig;

    let modelDir  = Util.getValueByPath(oolongConfig, 'oolong.modelDir');
    if (!modelDir) {
        throw new Error('"oolong.modelDir" not found in oolong config.');
    }

    let dslSourceDir = Util.getValueByPath(oolongConfig, 'oolong.dslSourceDir');
    if (!dslSourceDir) {
        throw new Error('"oolong.dslSourceDir" not found in oolong config.');
    }

    let scriptSourceDir = Util.getValueByPath(oolongConfig, 'oolong.scriptSourceDir');
    if (!scriptSourceDir) {
        throw new Error('"oolong.scriptSourceDir" not found in oolong config.');
    }

    let modelPath = core.app.toAbsolutePath(modelDir);    
    let dslSourcePath = core.app.toAbsolutePath(dslSourceDir);    
    let scriptSourcePath = core.app.toAbsolutePath(scriptSourceDir);

    if (!fs.existsSync(modelPath)) {
        return Promise.reject(`Model directory "${modelPath}" not found.`);
    }

    if (!fs.existsSync(dslSourcePath)) {
        return Promise.reject(`DSL source directory "${dslSourcePath}" not found.`);
    }

    if (!fs.existsSync(scriptSourcePath)) {
        return Promise.reject(`Database scripts directory "${scriptSourcePath}" not found.`);
    }

    let useJsonSource = Util.getValueByPath(oolongConfig, 'oolong.useJsonSource', false);

    return core.api.migrate_({
        logger: core.app.logger,
        modelPath,
        dslSourcePath,        
        scriptSourcePath,
        useJsonSource,
        schemaDeployment: core.schemaDeployment
    }, core.option('reset'));
};

exports.reverse = async (core) => {
    core.app.log('verbose', 'oolong reverse');

    let oolongConfig = core.oolongConfig;

    let dslReverseOutputDir = Util.getValueByPath(oolongConfig, 'oolong.dslReverseOutputDir');
    if (!dslReverseOutputDir) {
        throw new Error('"oolong.dslOutputDir" not found in oolong config.');
    }

    let outputDir = core.getReverseOutputDir(core.app.toAbsolutePath(dslReverseOutputDir));

    //todo: relocation, and deep copy connection options
    let conn = core.option('conn');
    let [ driver ] = extractDriverAndConnectorName(conn);
    let connOptions = Util.getValueByPath(oolongConfig, conn);
    assert: connOptions;    

    if (typeof connOptions.reverseRules === 'string') {
        connOptions.reverseRules = require(core.app.toAbsolutePath(connOptions.reverseRules));
    } 

    assert: !connOptions.reverseRules || _.isPlainObject(connOptions.reverseRules);

    return core.api.reverse_({ 
        logger: core.app.logger,
        dslReverseOutputDir: outputDir,
        driver,
        connOptions
    });
};
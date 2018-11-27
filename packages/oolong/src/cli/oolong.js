#!/usr/bin/env node

const CliApp = require('@k-suite/app');
const winston = require('winston');
const { combine, timestamp, colorize, json, simple } = winston.format;
const path = require('path');
const OolongCore = require('./OolongCore');
const pkg = require('../../package.json');

const CWD = process.cwd();
const logPath = path.resolve(CWD, 'oolong-cli.log');

let cliApp = new CliApp('oolong', { 
    logger: {        
        "transports": [
            {
                "type": "console",
                "options": {                            
                    "level": "debug",
                    "format": combine(colorize(), simple())
                }
            },
            {
                "type": "file",
                "options": {
                    "level": "verbose",
                    "format": combine(timestamp(), json()),
                    "filename": logPath //`${logPath}`
                }
            }
        ]
    },
    loadConfigFromOptions: true,
    config: {
        "version": pkg.version,
        "commandLineOptions": {
            "banner": `Oolong command line helper v${pkg.version}`,
            "program": "oolong",
            "arguments": [
                { "name": "command", "default": 'main' }
            ],  
            "options": {                
                "e": {
                    "desc": "Target environment",
                    "alias": [ "env", "environment" ],
                    "default": "development"
                },
                "s": {
                    "desc": "Silent mode",
                    "alias": [ "silent" ],
                    "isBool": true,
                    "default": false
                },            
                "v": {
                    "desc": "Show version number",
                    "alias": [ "version" ],
                    "isBool": true,
                    "default": false
                },
                "?": {
                    "desc": "Show usage message",
                    "alias": [ "help" ],
                    "isBool": true,
                    "default": false
                }
            }
        }
    }
});

cliApp.start_().then(async () => {
    let core = new OolongCore(cliApp);

    if (await core.initialize_()) {
        await core.execute_();        
        return cliApp.stop_();
    }    

    core.showUsage();
    await cliApp.stop_();

    process.exit(1);
}).catch(error => {
    console.error(error);
    process.exit(1);
});
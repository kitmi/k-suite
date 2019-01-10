"use strict";

require('./babel-for-test');

const path = require('path');
const WebServer = require('../lib/WebServer');

const WORKING_DIR = path.resolve(__dirname, 'temp');

let webServer = new WebServer('test server', { 
    workingPath: WORKING_DIR,
    logger: {
        level: 'verbose'
    },
    logWithAppName: true
});

webServer.once('configLoaded', () => {
    webServer.config = {
        "koa": {
        },
        "middlewares": {
            "bodyParser": {},
            "methodOverride": {}
        },
        "routing": {
            "/api": {
                "rest": {}
            }
        }
    };
});

webServer.start_().then(() => {
    console.log('.....');
}).catch(error => {
    console.error(error);
    process.exit(1);
});
"use strict";

const path = require('path');
const WebServer = require('../lib/WebServer');

const WORKING_DIR = path.resolve(__dirname, 'fixtures/app-bvt');

let webServer = new WebServer('test server', { 
    workingPath: WORKING_DIR
});

webServer.start_().then(() => {
    console.log('.....');
}).catch(error => {
    console.error(error);
    process.exit(1);
});;
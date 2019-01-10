"use strict";

const CliApp = require('../');

let cliApp = new CliApp('test', { 
    workingPath: 'test/fixtures/builtin-test',
    logger: {
        level: 'verbose'
    }
});

cliApp.start_().then(() => {
    cliApp.log('info', 'started.');

    cliApp.showUsage();

    let biLogs = cliApp.getService('logger:bi');
    biLogs.info({
        user: 'tester',
        operation: 'ad hoc smoke test'
    });

    let tracer = cliApp.getService('logger:trace');
    tracer.info(cliApp.settings.parser.lib);

    return cliApp.stop_();
}).catch(error => {
    console.error(error);
    process.exit(1);
});
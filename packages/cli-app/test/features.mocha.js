'use strict';

/**
 * Module dependencies.
 */

const Util = require('rk-utils');
const CliApp = require('..');

const WORKING_DIR = 'test/fixtures/features-test';

describe.only('custom features', function () {    
    let cliApp;

    let initLoadedBeforeOthers = false;
    let pluginLoadedFinally = false;
    let serviceLoadedAfterInit = false;

    before(async function () {
        cliApp = new CliApp('test', { 
            workingPath: WORKING_DIR
        });

        cliApp.on('after:Initial', () => {
            initLoadedBeforeOthers = !cliApp.plugin; 

            let service = cliApp.getService('service1'); 
            initLoadedBeforeOthers = initLoadedBeforeOthers && !service;
        });

        cliApp.on('after:Plugins', () => {
            pluginLoadedFinally = 'init' in cliApp;
            let service = cliApp.getService('service1'); 
            pluginLoadedFinally = pluginLoadedFinally && service !== undefined;
        });

        cliApp.on('after:Services', () => {
            serviceLoadedAfterInit = 'init' in CliApp;
            serviceLoadedAfterInit = serviceLoadedAfterInit && !('plug' in CliApp);

            let service = cliApp.getService('service1'); 
            serviceLoadedAfterInit = serviceLoadedAfterInit && service !== undefined;
        });

        return cliApp.start_();
    });

    after(async function () {
        let logFile = cliApp.toAbsolutePath('test.log');
        await cliApp.stop_();        
        Util.fs.removeSync(logFile);
    });

    it('feature init should loaded before others', function () {
        initLoadedBeforeOthers.should.be.ok();
    });

    it('feature init should loaded correctly', function () {
        cliApp.init.should.equal('option item of init');
    });

    it('feature service1 should loaded after init', function () {
        serviceLoadedAfterInit.should.be.ok();
    });

    it('feature service1 should loaded correctly', function () {
        let service = cliApp.getService('service1'); 
        let result = service.invoke_();
        result.should.equal('option item of service orverrided');
    });
    
    it('feature plugin should loaded finally', function () {
        pluginLoadedFinally.should.be.ok();
    });

    it('feature plugin should loaded correctly', function () {
        cliApp.plugin.should.equal('option item of plugin');
    });
    
    it('feature service2 should loaded correctly by cfg reload', function () {
        let service = cliApp.getService('service2'); 
        let result = service.invoke_();
        result.should.equal('option item of service2');
    });

    it('version reference', function () {
        should.exist(cliApp.version);
        cliApp.version.should.equal('2.0.0');
    });

    it('featureInit2', function () {
        should.exist(cliApp.init2);
        cliApp.init2.should.containEql({ item: "option item of init" });
    });

    it('init3_4', function () {
        should.exist(cliApp.init3);
        cliApp.init3.should.equal('this is init3');

        should.exist(cliApp.init4);
        cliApp.init4.should.equal('this is init4');
    });
});
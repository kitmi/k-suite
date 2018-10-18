'use strict';

const path = require('path');
const Util = require('rk-utils');
const CliApp = require('../../../lib/App');

const WORKING_DIR = path.resolve(__dirname, '../../../test/temp');

describe('feature:timezone', function () {
    let cliApp;

    before(async function () {
        Util.fs.emptyDirSync(WORKING_DIR);

        cliApp = new CliApp('test server', { 
            workingPath: WORKING_DIR
        });

        cliApp.once('configLoaded', () => {
            cliApp.config = {
                "timezone": "Australia/Sydney"
            };
        });

        return cliApp.start_();
    });

    after(async function () {        
        await cliApp.stop_();    
        Util.fs.removeSync(WORKING_DIR);
    });

    describe('unittest', function () {
        it('timezone should work', function (done) {            
            let start = cliApp.now()
            let isoDT = start.toISO();
            (typeof isoDT).should.be.equal('string');

            setTimeout(() => {
                let duration = cliApp.now().diff(start).milliseconds;
                duration.should.be.above(99);
                duration.should.be.below(200);
                done();
            }, 100)
        });
    });
});
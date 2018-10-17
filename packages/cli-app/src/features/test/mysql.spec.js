'use strict';

const path = require('path');
const Util = require('rk-utils');
const CliApp = require('../../../lib/CliApp');

const WORKING_DIR = path.resolve(__dirname, '../../../test/temp');

describe('feature:mysql', function () {
    let cliApp;

    before(async function () {
        Util.fs.emptyDirSync(WORKING_DIR);

        cliApp = new CliApp('test server', { 
            workingPath: WORKING_DIR
        });

        cliApp.once('configLoaded', () => {
            cliApp.config = {
                "mysql": {
                    "test": {
                        "connection": "mysql://root:root@localhost/cli-app-test"
                    }
                }
            };
        });

        return cliApp.start_();
    });

    after(async function () {        
        await cliApp.stop_();    
        Util.fs.removeSync(WORKING_DIR);
    });

    describe('bvt', function () {
        it('mysql db service should work', async function () {            
            let testService = cliApp.getService('mysql:test');
            should.exists(testService); 

            let conn = await testService.getConnection_();
            should.exists(conn); 

            let [ tables ] = await conn.query("select * from information_schema.tables where table_schema = ?", [ testService.dbName ]);
            should.exists(tables); 
            tables.length.should.be.exactly(0);

            testService.closeConnection(conn);
        });
    });
});
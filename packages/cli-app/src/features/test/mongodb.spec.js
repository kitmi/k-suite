'use strict';

const path = require('path');
const Util = require('rk-utils');
const CliApp = require('../../../lib/CliApp');

const WORKING_DIR = path.resolve(__dirname, '../../../test/temp');

describe('feature:mongodb', function () {
    let cliApp;

    before(async function () {
        Util.fs.emptyDirSync(WORKING_DIR);

        cliApp = new CliApp('test server', { 
            workingPath: WORKING_DIR
        });

        cliApp.once('configLoaded', () => {
            cliApp.config = {
                "mongodb": {
                    "test": {
                        "connection": "mongodb://root:root@localhost:27017/cli-app-test?authSource=admin"
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
        it('mongodb service should work', async function () {            
            let testService = cliApp.getService('mongodb:test');
            should.exists(testService); 

            let conn = await testService.getConnection_();
            should.exists(conn); 

            let db = conn.db();
            should.exists(db); 

            let collection = db.collection('test');
            should.exists(collection); 

            let result = await collection.insertOne(
                { item: "canvas", qty: 100, tags: ["cotton"], size: { h: 28, w: 35.5, uom: "cm" } }
            );
            
            result.result.ok.should.be.exactly(1);
            result.result.n.should.be.exactly(1);
            result.insertedCount.should.be.exactly(1);

            let deleted = await collection.deleteOne({ _id: result.insertedId });
            deleted.result.ok.should.be.exactly(1);
            deleted.result.n.should.be.exactly(1);
            deleted.deletedCount.should.be.exactly(1);

            testService.closeConnection(conn);
        });
    });
});
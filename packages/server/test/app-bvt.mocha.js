'use strict';

/**
 * Module dependencies.
 */

const path = require('path');
const request = require('supertest');
const sh = require('shelljs');
const Util = require('rk-utils');
const WebServer = require('../lib/WebServer');

const WORKING_DIR = path.resolve(__dirname, 'fixtures/app-bvt');

describe('bvt', function () {
    let webServer;

    before(async function () {
        webServer = new WebServer('test server', { 
            workingPath: WORKING_DIR
        });

        return webServer.start_();
    });

    after(async function () {        
        await webServer.stop_();        
        sh.rm('-rf', path.join(WORKING_DIR, '*.log'));
    });

    describe('feature:appRouting', function () {
        it('ruleRouter:should return a page rendered by swig', function (done) {            
            request(webServer.httpServer)
                .get('/test')
                .expect('content-type', 'text/html; charset=utf-8')
                .expect(/<title>Test.index<\/title>/)
                .expect(200)
                .end(done);
        });

        it('middleware:serveStatic: should return a text file in the test app', function (done) {
            request(webServer.httpServer)
                .get('/test/text-file.txt')
                .expect('content-type', 'text/plain; charset=utf-8')
                .expect('This is a test file in submodule.')
                .expect(200)
                .end(done);
        });
    });
});
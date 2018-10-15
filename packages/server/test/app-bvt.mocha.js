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

describe('app-bvt', function () {
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

    describe('router:module', function () {
        it('should return action1', function (done) {
            request(webServer.httpServer)
                    .get('/test/module/action1')
                    .expect('content-type', 'text/plain; charset=utf-8')
                    .expect('action1')
                    .expect(200)
                    .end(done);
        });

        it('should return Hello World by post', function (done) {
            request(webServer.httpServer)
                    .post('/test/module/action1')
                    .send({name: 'Hello World!'})
                    .expect('content-type', 'text/plain; charset=utf-8')
                    .expect('you post: Hello World!')
                    .expect(200)
                    .end(done);
        });

        it('should return Hello', function (done) {
            request(webServer.httpServer)
                    .get('/test/module/action2')
                    .expect('content-type', 'text/plain; charset=utf-8')
                    .expect('Hello')
                    .expect(200)
                    .end(done);
        });
    });

    describe('router:module with controller decorators', function () {
        it('should return action1', function (done) {
            request(webServer.httpServer)
                    .get('/test/module2/action1')
                    .expect('content-type', 'text/plain; charset=utf-8')
                    .expect('action1')
                    .expect(200)
                    .end(done);
        });

        it('should return Hello World by post', function (done) {
            request(webServer.httpServer)
                    .post('/test/module2/action1')
                    .send({name: 'Hello World!'})
                    .expect('content-type', 'text/plain; charset=utf-8')
                    .expect('you post: Hello World!')
                    .expect(200)
                    .end(done);
        });

        it('should return Hello', function (done) {
            request(webServer.httpServer)
                    .get('/test/module2/action2')
                    .expect('content-type', 'text/plain; charset=utf-8')
                    .expect('Hello')
                    .expect(200)
                    .end(done);
        });
    });

    describe('router:rest module function', function () {
        it('should get a list of books', function (done) {
            request(webServer.httpServer)
                .get('/test/api/book')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect(function (res) {
                    if (!Array.isArray(res.body)) {
                        return 'Result is not a list';
                    }

                    if (res.body.length !== 2) {
                        return 'Unexpected result';
                    }
                })
                .end(done);
        });
        it('should add a new book', function (done) {
            request(webServer.httpServer)
                .post('/test/api/book')
                .send({ title: 'Avatar' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 3, title: 'Avatar' })
                .end(done);
        });
        it('should get book 2 successfully', function (done) {
            request(webServer.httpServer)
                .get('/test/api/book/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Book 2' })
                .end(done);
        });
        it('should update book 2 successfully', function (done) {
            request(webServer.httpServer)
                .put('/test/api/book/2')
                .send({ title: 'Brave Cross' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Brave Cross' })
                .end(done);
        });
        it('should delete book 2 successfully', async function () {
            await request(webServer.httpServer)
                .del('/test/api/book/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Brave Cross' });

            await request(webServer.httpServer)
                .get('/test/api/book/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({});            
        });
        it('should return 404', function (done) {
            request(webServer.httpServer)
                .get('/test/api/non_exist/1')
                .set('Accept', 'application/json')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(404)
                .end(done);
        });
    });

    describe('router:rest controller mode', function () {
        it('should get a list of books', function (done) {
            request(webServer.httpServer)
                .get('/test/api/book-2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect(function (res) {
                    if (!Array.isArray(res.body)) {
                        return 'Result is not a list';
                    }

                    if (res.body.length !== 2) {
                        return 'Unexpected result';
                    }
                })
                .end(done);
        });
        it('should add a new book', function (done) {
            request(webServer.httpServer)
                .post('/test/api/book-2')
                .send({ title: 'Avatar' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 3, title: 'Avatar' })
                .end(done);
        });
        it('should get book 2 successfully', function (done) {
            request(webServer.httpServer)
                .get('/test/api/book-2/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Book 2' })
                .end(done);
        });
        it('should update book 2 successfully', function (done) {
            request(webServer.httpServer)
                .put('/test/api/book-2/2')
                .send({ title: 'Brave Cross' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Brave Cross' })
                .end(done);
        });
        it('should delete book 2 successfully', async function () {
            await request(webServer.httpServer)
                .del('/test/api/book-2/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Brave Cross' });

            await request(webServer.httpServer)
                .get('/test/api/book-2/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({});            
        });
    });
});
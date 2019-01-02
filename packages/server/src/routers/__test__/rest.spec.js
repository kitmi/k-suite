'use strict';

const path = require('path');
const request = require('supertest');
const Util = require('rk-utils');
const WebServer = require('../../WebServer');

const WORKING_DIR = path.resolve(__dirname, '../../../test/temp');

let resourceBook = `
const Util = require('rk-utils');

let books = [ { id: 1, title: 'Book 1' }, { id: 2, title: 'Book 2' } ];
let maxid = 2;

exports.query = (ctx) => {
    ctx.body = books;
};

exports.create = (ctx) => {
    let newBook = {id: ++maxid, title: ctx.request.body.title};
    books.push(newBook);
    ctx.body = newBook;
};

exports.detail = (ctx) => {
    let id = ctx.params.id;
    ctx.body =  Util._.find(books, book => book.id == id) || {};
};

exports.update = (ctx) => {
    let id = ctx.params.id;
    let bookFound = Util._.find(books, book => book.id == id);

    bookFound.title = ctx.request.body.title;
    ctx.body =  bookFound;
};

exports.remove = (ctx) => {
    let id = ctx.params.id;
    let idx = Util._.findIndex(books, book => book.id == id);
    ctx.body = books.splice(idx, 1)[0];
};
`;

describe('unit:router:rest', function () {
    let webServer;

    before(async function () {
        Util.fs.emptyDirSync(WORKING_DIR);
        let resourcesPath = path.join(WORKING_DIR, 'server', 'resources');
        Util.fs.ensureDirSync(resourcesPath);
        Util.fs.writeFileSync(path.join(resourcesPath, 'book.js'), resourceBook);

        webServer = new WebServer('test server', {
            workingPath: WORKING_DIR
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

        return webServer.start_();
    });

    after(async function () {
        await webServer.stop_();
        Util.fs.removeSync(WORKING_DIR);
    });

    describe('module function', function () {
        it('should get a list of books', function (done) {
            request(webServer.httpServer)
                .get('/api/book')
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
                .post('/api/book')
                .send({ title: 'Avatar' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 3, title: 'Avatar' })
                .end(done);
        });
        it('should get book 2 successfully', function (done) {
            request(webServer.httpServer)
                .get('/api/book/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Book 2' })
                .end(done);
        });
        it('should update book 2 successfully', function (done) {
            request(webServer.httpServer)
                .put('/api/book/2')
                .send({ title: 'Brave Cross' })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Brave Cross' })
                .end(done);
        });
        it('should delete book 2 successfully', async function () {
            await request(webServer.httpServer)
                .del('/api/book/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({ id: 2, title: 'Brave Cross' });

            await request(webServer.httpServer)
                .get('/api/book/2')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .expect({});            
        });
        it('should return 404', function (done) {
            request(webServer.httpServer)
                .get('/api/non_exist/1')
                .set('Accept', 'application/json')
                .expect('Content-Type', 'text/plain; charset=utf-8')
                .expect(404)
                .end(done);
        });
    });
});
'use strict';

const winston = require('winston');
const path = require('path');
const Linker = require('../../../lib/lang/Linker');

const SOURCE_PATH = path.resolve(__dirname, '../../../test/unit');

describe.only('unit:lang:Linker', function () {    
    let linker;

    let logger = winston.createLogger({
        "level": "info",
        "transports": [
            new winston.transports.Console({                            
                "format": winston.format.combine(winston.format.colorize(), winston.format.simple())
            })
        ]
    });

    beforeEach(function () {
        linker = new Linker({ logger, sourcePath: SOURCE_PATH });
    });

    describe('load module', function () {
        it('compile product schema', function () {
            let mod = linker.loadModule('product.ols');

            let expected =
            {
                "namespace": [
                    path.join(SOURCE_PATH, 'entities', 'product.ols')
                ],
                "schema": {
                    "product": {
                        "entities": [
                            "product"
                        ]
                    }
                },
                "id": "./product.ols",
                "name": "product"
            };
            should.exists(mod);            
            mod.should.be.eql(expected);
        });

        it('compile product entity', function () {
            let mod = linker.loadModule('entities/product.ols');

            let expected =
            {
                "namespace": [
                    path.resolve(__dirname, '../../../lib/lang/builtins/types.ols'),
                    path.resolve(__dirname, '../../../lib/lang/builtins/dictionary.ols')
                ],
                "entity": {
                    "product": {
                        "features": [
                            "autoId",
                            {
                                "name": "atLeastOneNotNull",
                                "args": [
                                    "name",
                                    "email"
                                ]
                            }
                        ],
                        "fields": {
                            "name": {
                                "name": "name",
                                "type": "text",
                                "maxLength": 40
                            },
                            "email": {
                                "name": "email",
                                "type": "email"
                            },
                            "desc": {
                                "name": "desc",
                                "type": "text",
                                "maxLength": 2000,
                                "optional": true,
                                "comment": "Description"
                            }
                        }
                    }
                },
                "id": "./entities/product.ols",
                "name": "product"
            };
            should.exists(mod);            
            mod.should.be.eql(expected);
        });
    });

    describe('load element', function () {
        it('load product entity from schema', function () {
            let schemaMod = linker.loadModule('product.ols');
            let refId = 'entity:product<-' + schemaMod.id;

            let productMod = linker.loadModule('entities/product.ols');
            let selfId = 'entity:product@' + productMod.id;

            linker._elementsCache.should.not.have.key(refId);
            linker._elementsCache.should.not.have.key(selfId);

            let productEntity = linker.loadElement(schemaMod, 'entity', 'product');
            should.exists(productEntity);
            productEntity.name.should.eql('product');

            linker._elementsCache.should.have.key(refId);
            linker._elementsCache.should.have.key(selfId);

            linker._elementsCache[refId].should.eql(productEntity);
            linker._elementsCache[selfId].should.eql(productEntity);
        });
    });

    describe('link a schema', function () {
        it('linker.link', function () {
            linker.link('product.ols', 'product');
            console.log(linker.schema.toJSON());
        });
    });

    describe('link json sources', function () {
        it('linker.options.useJsonSource=true', function () {
            
        });
    });
});
'use strict';

const winston = require('winston');
const path = require('path');
const Linker = require('../../../lib/lang/Linker');

const SOURCE_PATH = path.resolve(__dirname, '../../../test/unitLinker');

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
        linker = new Linker({ logger, dslSourcePath: SOURCE_PATH/*, saveIntermediate: true */ });
    });

    describe('load module', function () {
        it('compile product schema', function () {
            let mod = linker.loadModule('product.ool');

            let expected =
            {
                "namespace": [
                    path.join(SOURCE_PATH, 'entities', 'product.ool'),
                    path.join(SOURCE_PATH, 'entities', 'user.ool')
                ],
                "schema": {
                    "product": {
                        "entities": [
                            { "entity": "product" },
                            { "entity": "user" }
                        ]
                    }
                },
                "id": "./product.ool",
                "name": "product"
            };
            should.exists(mod);            
            mod.should.be.eql(expected);
        });

        it('compile product entity', function () {
            let mod = linker.loadModule('entities/product.ool');

            let expected =
            {
                "namespace": [
                    path.resolve(__dirname, '../../../lib/lang/builtins/types.ool'),
                    path.resolve(__dirname, '../../../lib/lang/builtins/dictionary.ool')
                ],
                "entity": {
                    "product": {
                        "features": [
                            "autoId",
                            {
                                "name": "atLeastOneNotNull",
                                "args": [
                                    [ "name", "email" ]
                                ]
                            }
                        ],
                        "fields": {
                            "name": {
                                "name": "name",
                                "type": "text",
                                "maxLength": [ 40 ]
                            },
                            "email": {
                                "name": "email",
                                "type": "email"
                            },
                            "desc": {
                                "name": "desc",
                                "type": "text",
                                "maxLength": [ 2000 ],
                                "optional": true,
                                "comment": "Description"
                            }
                        }
                    }
                },
                "id": "./entities/product.ool",
                "name": "product"
            };
            should.exists(mod);            
            mod.should.be.eql(expected);
        });
    });

    describe.only('load element', function () {
        it('load product entity from schema', function () {
            let schemaMod = linker.loadModule('product.ool');
            let refId = 'entity:product<-' + schemaMod.id;

            let productMod = linker.loadModule('entities/product.ool');
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
            linker.link('product.ool', 'product');
            linker.schemas.should.have.key('product')
            let linked = linker.schemas['product'].toJSON();
            linked.displayName.should.equal('Product');
            linked.entities.should.have.key('product');

            let product = linked.entities['product'];
            product.should.have.key('name', 'displayName', 'fields', 'key');
            product.name.should.equal('product');
            product.displayName.should.equal('Product');
            product.fields.should.have.key('id', 'name', 'email', 'desc');
            product.key.should.equal('id');
        });
    });

    describe('link json sources', function () {
        it('linker.options.useJsonSource=true', function () {
            let linker2 = new Linker({ useJsonSource: true, dslSourcePath: SOURCE_PATH });

            linker2.link('product.ool.json', 'product');
            linker2.schemas.should.have.key('product')
            let linked = linker2.schemas['product'].toJSON();
            linked.displayName.should.equal('Product');
            linked.entities.should.have.key('product');

            let product = linked.entities['product'];
            product.should.have.key('name', 'displayName', 'fields', 'key');
            product.name.should.equal('product');
            product.displayName.should.equal('Product');
            product.fields.should.have.key('id', 'name', 'email', 'desc');
            product.key.should.equal('id');
        });
    });
});
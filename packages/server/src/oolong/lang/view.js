"use strict";

const path = require('path');

const Util = require('../../util.js');
const _ = Util._;

const OolUtils = require('./ool-utils.js');
const Document = require('./document.js');

class OolongView {
    /**
     * Oolong view
     * @constructs OolongView
     * @param {OolongLinker} linker
     * @param {string} name - View name
     * @param {*} oolModule - Source ool module
     * @param {object} info - View info
     */
    constructor(linker, name, oolModule, info) {
        //immutable
        /**
         * Linker to process this view
         * @type {OolongLinker}
         * @public
         */
        this.linker = linker;

        /**
         * Name of this view
         * @type {string}
         * @public
         */
        this.name = name;

        /**
         * Owner oolong module
         * @type {*}
         * @public
         */
        this.oolModule = oolModule;

        /**
         * Raw metadata
         * @type {Object}
         * @public
         */
        this.info = info;        
        
        this.document = undefined;

        this.isList = false;

        this.params = undefined;

        this.selectBy = undefined;

        this.groupBy = undefined;

        this.orderBy = undefined;

        this.skip = undefined;

        this.limit = undefined;

        /**
         * Flag of initialization
         * @type {boolean}
         * @public
         */
        this.initialized = false;
    }

    /**
     * Clone the view
     * @param {Map} [stack] - Reference stack to avoid recurrence copy
     * @returns {OolongView}
     */
    clone(stack) {
        if (!stack) stack = new Map();
        let cl = new OolongView(this.linker, this.name, this.oolModule, this.info);
        stack.set(this, cl);

        OolUtils.deepCloneField(this, cl, 'document', stack);
        OolUtils.deepCloneField(this, cl, 'params', stack);
        OolUtils.deepCloneField(this, cl, 'selectBy', stack);
        OolUtils.deepCloneField(this, cl, 'groupBy', stack);
        OolUtils.deepCloneField(this, cl, 'orderBy', stack);
        OolUtils.deepCloneField(this, cl, 'skip', stack);
        OolUtils.deepCloneField(this, cl, 'limit', stack);

        cl.isList = this.isList;
        cl.initialized = this.initialized;

        return cl;
    }

    /**
     * Start linking this view
     * @returns {OolongView}
     */
    link() {
        if (this.initialized) {
            return this;
        }

        if (this.info.document) {
            this.document = this.linker.loadDoc(this.oolModule, this.info.document);
        } else {
            assert: this.info.entity, 'Invalid view syntax!';
            
            let mainEntity = this.linker.getReferencedEntity(this.oolModule, this.info.entity);
            
            this.document = new Document(this.linker, mainEntity.name, this.oolModule, { mainEntity: mainEntity.name });
            this.document.link();
        }

        if (this.info.isList) {
            this.isList = true;
        }

        if (!_.isEmpty(this.info.accept)) {
            this.params = this.info.accept.concat();
        }

        if (!_.isEmpty(this.info.selectBy)) {
            this.selectBy = this.info.selectBy.concat();
        }

        if (!_.isEmpty(this.info.groupBy)) {
            this.groupBy = this.info.groupBy.concat();
        }

        if (!_.isEmpty(this.info.orderBy)) {
            this.orderBy = this.info.orderBy.concat();
        }

        if (this.info.skip) {
            this.skip = _.isPlainObject(this.info.skip) ? Object.assign({}, this.info.skip) : this.info.skip;
        }

        if (this.info.limit) {
            this.limit = _.isPlainObject(this.info.limit) ? Object.assign({}, this.info.limit) : this.info.limit;
        }

        this.initialized = true;

        return this;
    }

    inferTypeInfo(inSchema) {
        if (!_.isEmpty(this.params)) {
            let inferredParams = [];

            this.params.forEach(param => {
                if (OolUtils.isMemberAccess(param.type)) {
                    let [ entityName, fieldName ] = param.type.split('.');

                    if (!inSchema.hasEntity(entityName)) {
                        throw new Error(`Parameter "${param.name}" references to an entity "${entityName}" which is not belong to the schema.`);
                    }

                    let entity = inSchema.entities[entityName];
                    //console.dir(entity.toJSON(), {depth: 8, colors: true});

                    let field = entity.getEntityAttribute(fieldName);
                    inferredParams.push(Object.assign(_.omit(_.toPlainObject(field), ['isReference', 'optional', 'displayName']), {name: param.name}));
                } else {
                    inferredParams.push(this.linker.trackBackType(this.oolModule, param));
                }
            });

            this.params = inferredParams;
        }
    }

    getDocumentHierarchy(inSchema) {
        return inSchema.getDocumentHierachy(this.oolModule, this.document.name);
    }
    
    /**
     * Translate the view into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return {            
            name: this.name,
            document: this.document.toJSON(),
            isList: this.isList,
            params: this.params,
            selectBy: this.selectBy,
            groupBy: this.groupBy,
            orderBy: this.orderBy,
            skip: this.skip,
            limit: this.limit
        };
    }
}

module.exports = OolongView;
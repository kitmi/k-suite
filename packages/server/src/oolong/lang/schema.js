"use strict";

const Util = require('../../util.js');
const _ = Util._;

const OolUtils = require('./ool-utils.js');

class OolongSchema {
    /**
     * Oolong schema
     * @constructs OolongSchema
     * @param {OolongLinker} linker
     * @param {*} oolModule
     */
    constructor(linker, oolModule) {
        /**
         * Linker to process this schema
         * @type {OolongLinker}
         * @public
         */
        this.linker = linker;

        /**
         * Name of this entity
         * @type {string}
         * @public
         */
        this.name = oolModule.name;

        /**
         * Owner oolong module
         * @type {*}
         * @public
         */
        this.oolModule = oolModule;

        /**
         * Raw metadata
         * @type {object}
         * @public
         */
        this.info = oolModule.schema;

        /**
         * Entities in this schema
         * @type {object}
         * @public
         */
        this.entities = {};

        /**
         * Relations in this schema
         * @type {array}
         * @public
         * @example
         *  [ { left, right, optional, size, relationship, type, multi } ]
         */
        this.relations = [];

        /**
         * Views
         * @type {object}
         * @public
         */
        this.views = {};

        /**
         * Documents
         * @type {object}
         * @public
         */
        this.documents = {};

        /**
         * Flag of initialization
         * @type {boolean}
         * @public
         */
        this.initialized = false;
    }

    /**
     * Clone the schema
     * @param {Map} [stack] - Reference stack to avoid recurrence copy
     * @returns {OolongSchema}
     */
    clone(stack) {
        if (!stack) stack = new Map();
        let cl = new OolongSchema(this.linker, this.oolModule);
        stack.set(this, cl);
        
        cl.entities = OolUtils.deepClone(this.entities, stack);
        cl.relations = OolUtils.deepClone(this.relations, stack);
        cl.views = OolUtils.deepClone(this.views, stack);
        cl.documents = OolUtils.deepClone(this.documents, stack);

        cl.initialized = this.initialized;

        return cl;
    }

    /**
     * Start linking this schema
     * @returns {OolongSchema}
     */
    link() {
        if (this.initialized) {
            return this;
        }

        this.linker.log('debug', 'Initializing schema [' + this.name + '] ...');

        //1st round, get direct output entities
        if (!_.isEmpty(this.info.entities)) {
            this.info.entities.forEach(entityEntry => {
                let entity = this.linker.loadEntity(this.oolModule, entityEntry);
                this.addEntity(entity);
            });
        }

        if (!_.isEmpty(this.info.views)) {
            this.info.views.forEach(viewName => {
                this.views[viewName] = this.linker.loadView(this.oolModule, viewName);
            });
        }

        this.initialized = true;

        return this;
    }

    /**
     * Add relation into this schema
     * @param {object} relation
     * @returns {OolongSchema}
     */
    addRelation(relation) {
        if (!this.hasEntity(relation.left.name)) {
            this.addEntity(relation.left);
        }

        if (!this.hasEntity(relation.right.name)) {
            this.addEntity(relation.right);
        }

        let r = Object.assign({}, relation, { left: relation.left.name, right: relation.right.name });

        this.relations.push(r);

        return this;
    }

    /**
     * Check whether a entity with given name is in the schema
     * @param {string} entityName
     * @returns {boolean}
     */
    hasEntity(entityName) {
        return (entityName in this.entities);
    }

    /**
     * Add an entity into the schema
     * @param {OolongEntity} entity
     * @returns {OolongSchema}
     */
    addEntity(entity) {
        if (this.hasEntity(entity.name)) {
            throw new Error(`Entity name [${entity.name}] conflicts in schema [${this.name}].`);
        }

        this.entities[entity.name] = entity;

        return this;
    }

    /**
     * Get a document hierarchy
     * @param {object} fromModule
     * @param {string} docName
     * @returns {object}
     */
    getDocumentHierachy(fromModule, docName) {
        if (docName in this.documents) {
            return this.documents[docName];
        }

        let doc = this.linker.loadDoc(fromModule, docName);
        return (this.documents[docName] = doc.buildHierarchy(this));
    }

    /**
     * Translate the schema into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return {
            name: this.name,
            entities: _.reduce(this.entities, (r, v, k) => (r[k] = v.toJSON(), r), {}),
            views: _.reduce(this.views, (r, v, k) => (r[k] = v.toJSON(), r), {}),
            relations: this.relations,
            documents: this.documents
        };
    }
}

module.exports = OolongSchema;
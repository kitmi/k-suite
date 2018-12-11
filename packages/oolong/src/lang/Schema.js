"use strict";

const { _ } = require('rk-utils');
const { generateDisplayName, deepCloneField, Clonable, schemaNaming } = require('./OolUtils');

/**
 * Oolong schema class.
 * @class OolongSchema
 */
class Schema extends Clonable {
    /**
     * Entities in this schema, map of <entityName, entityObject>
     * @member {object.<string, OolongEntity>}
     */
    entities = {};

    /**
     * Relations in this schema
     * @member {array}
     * @example
     *  [ { left, right, optional, size, relationship, type, multi } ]
     */
    relations = [];

    /**
     * Datasets, dataset = entity + relations + projection
     * @member {object}
     */
    datasets = {};

    /**
     * Views, view = dataset + filters 
     * @member {object}
     */
    views = {};    

    /**     
     * @param {OolongLinker} linker
     * @param {string} name
     * @param {object} oolModule
     * @param {object} info
     */
    constructor(linker, name, oolModule, info) {
        super();

        /**
         * Linker to process this schema
         * @member {OolongLinker}
         */
        this.linker = linker;

        /**
         * Name of this entity
         * @member {string}
         */
        this.name = schemaNaming(name);

        /**
         * Owner oolong module
         * @member {object}
         */
        this.oolModule = oolModule;

        /**
         * Raw metadata
         * @member {object}
         */
        this.info = info;        
    }

    /**
     * Start linking this schema
     * @returns {Schema}
     */
    link() {
        pre: !this.linked;

        this.linker.log('debug', 'Linking schema [' + this.name + '] ...');

        if (this.info.comment) {
            /**
             * @member {string}
             */
            this.comment = this.info.comment;
        }

        /**
         * @member {string}
         */
        this.displayName = this.comment || generateDisplayName(this.name);

        //1st round, get direct output entities
        assert: !_.isEmpty(this.info.entities);

        this.info.entities.forEach(entityEntry => {            
            let entity = this.linker.loadEntity(this.oolModule, entityEntry.entity);
            assert: entity.linked;

            this.addEntity(entity);
        });

        if (!_.isEmpty(this.info.views)) {
            this.info.views.forEach(viewName => {
                this.linker.loadView(this.oolModule, viewName);
                assert: view.linked;

                this.addView(view);
            });
        }

        this.linked = true;

        return this;
    }

    /**
     * Add relation into this schema
     * @param {object} relation
     * @returns {Schema}
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
        pre: !this.hasEntity(entity.name), `Entity name [${entity.name}] conflicts in schema [${this.name}].`;

        this.entities[entity.name] = entity;

        return this;
    }

    /**
     * Check whether a view with given name is in the schema
     * @param {string} viewName
     * @returns {boolean}
     */
    hasView(viewName) {
        return (viewName in this.views);
    }

    /**
     * Add a view into the schema
     * @param {OolongView} view 
     * @returns {OolongSchema}
     */
    addView(view) {
        pre: !this.hasView(view.name), `View name [${view.name}] conflicts in schema [${this.name}].`;

        this.views[view.name] = view;

        return this;
    }

    /**
     * Get a document hierarchy
     * @param {object} fromModule
     * @param {string} datasetName
     * @returns {object}
     */
    getDocumentHierachy(fromModule, datasetName) {
        if (datasetName in this.datasets) {
            return this.datasets[datasetName];
        }

        let dataset = this.linker.loadDataset(fromModule, datasetName);
        return (this.datasets[datasetName] = dataset.buildHierarchy(this));
    }

    /**
     * Get the referenced entity, add it into schema if not in schema
     * @param {object} refererModule
     * @param {string} entityName
     * @returns {OolongEntity}
     */
    getReferencedEntity(refererModule, entityName) {
        let entity = this.liner.loadEntity(refererModule, entityName);

        if (!this.hasEntity(entity.name)) {
            throw new Error(`Entity "${entity.name}" not exists in schema "${this.name}".`);
        }

        return entity;
    }

    /**
     * Clone the schema
     * @returns {Schema}
     */
    clone() {
        super.clone();
        
        let schema = new Schema(this.linker, this.name, this.oolModule, this.info);
        
        deepCloneField(this, schema, 'displayName');
        deepCloneField(this, schema, 'comment');
        deepCloneField(this, schema, 'relations');
        deepCloneField(this, schema, 'entities');
        deepCloneField(this, schema, 'relations');
        deepCloneField(this, schema, 'datasets');
        deepCloneField(this, schema, 'views');        

        schema.linked = true;

        return schema;
    }

    /**
     * Translate the schema into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return {
            name: this.name,
            displayName: this.displayName,
            comment: this.comment,        
            entities: _.mapValues(this.entities, entity => entity.toJSON()),
            relations: this.relations,
            datasets: _.mapValues(this.datasets, dataset => dataset.toJSON()), 
            views: _.mapValues(this.views, view => view.toJSON()) 
        };
    }
}

module.exports = Schema;
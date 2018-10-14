"use strict";

const EventEmitter = require('events');
const path = require('path');

const Util = require('../../util.js');
const _ = Util._;

const OolUtils = require('./ool-utils.js');
const Field = require('./field.js');

/**
 * Entity event listener
 * @callback OolongEntity.eventListener
 * returns {*}
 */

class OolongEntity {
    /**
     * Oolong entity
     * @constructs OolongEntity
     * @param {OolongLinker} linker
     * @param {string} name
     * @param {*} oolModule
     * @param {object} info
     */
    constructor(linker, name, oolModule, info) {
        this._events = new EventEmitter();

        //immutable
        /**
         * Linker to process this entity
         * @type {OolongLinker}
         * @public
         */
        this.linker = linker;

        /**
         * Name of this entity
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

        /**
         * Fields of the entity
         * @type {object}
         * @public
         */
        this.fields = {};

        /**
         * Comment of the entity
         * @type {string}
         * @public
         */
        this.comment = undefined;

        /**
         * Array of initialized features
         * @type {array}
         * @public
         */
        this.features = undefined;

        /**
         * Key field name
         * @type {string}
         * @public
         */
        this.key = undefined;

        /**
         * Indexes
         * @type {array}
         * @public
         */
        this.indexes = undefined;

        /**
         * Flag of relationship entity
         * @type {boolean}
         * @public
         */
        this.isRelationshipEntity = false;

        /**
         * List of api operations
         * @type {array}
         * @public
         */
        this.interfaces = undefined;

        /**
         * Flag of initialization
         * @type {boolean}
         * @public
         */
        this.initialized = false;
    }

    /**
     * Listen on an event
     * @param {string} eventName
     * @param {OolongEntity.eventListener} listener
     * @returns {EventEmitter}
     */
    on(eventName, listener) {
        return this._events.on(eventName, listener);
    }

    /**
     * Clone the entity
     * @param {Map} [stack] - Reference stack to avoid recurrence copy
     * @returns {OolongEntity}
     */
    clone(stack) {
        if (!stack) stack = new Map();
        let cl = new OolongEntity(this.linker, this.name, this.oolModule, this.info);
        stack.set(this, cl);

        OolUtils.deepCloneField(this, cl, 'comment', stack);
        OolUtils.deepCloneField(this, cl, 'fields', stack);
        OolUtils.deepCloneField(this, cl, 'features', stack);
        OolUtils.deepCloneField(this, cl, 'key', stack);        
        OolUtils.deepCloneField(this, cl, 'indexes', stack);
        OolUtils.deepCloneField(this, cl, 'interfaces', stack);

        cl.isRelationshipEntity = this.isRelationshipEntity;
        cl.initialized = this.initialized;

        return cl;
    }

    /**
     * Start linking this entity
     * @returns {OolongEntity}
     */
    link() {
        if (this.initialized) {
            return this;
        }

        //1.inherit from base entity if any
        //2.initialize features
        //3.add fields
        //4.add indexes
        //5.api

        this.linker.log('debug', 'Initializing entity [' + this.name + '] ...');

        if (this.info.base) {
            //inherit fields, processed features, key and indexes
            let baseEntity = this.linker.loadEntity(this.oolModule, this.info.base);
            this._inherit(baseEntity);
        }

        if (this.info.comment) {
            this.comment = this.info.comment;
        }

        // load features
        if (this.info.features) {
            this.info.features.forEach(feature => {
                
                let featureName = feature.name;

                let fn = require(path.resolve(__dirname, `./features/${featureName}.js`));
                fn(this, this.linker.translateOolValue(this.oolModule, feature.options));
            });
        }

        this._events.emit('beforeFields');

        // process fields
        if (this.info.fields) {
            _.each(this.info.fields, (fieldInfo, fieldName) => {
                this.addField(fieldName, fieldInfo);
            });
        }

        this._events.emit('afterFields');        

        if (this.info.key) {
            this.key = this.info.key;
            if (!this.hasField(this.key)) {
                throw new Error(`Key field "${this.key}" not exist in entity "${this.name}".`);
            }
        }

        if (this.info.interface) {
            this.interfaces = _.cloneDeep(this.info.interface);

            _.forOwn(this.interfaces, (intf) => {
                if (!_.isEmpty(intf.accept)) {
                    intf.accept = _.map(intf.accept, param => {
                        return _.omit(Object.assign({}, this.linker.trackBackType(this.oolModule, param)), ['subClass']);
                    });
                }
            });
        }

        this.initialized = true;

        return this;
    }

    /**
     * Mark the entity as an relationship entity
     * @returns {OolongEntity}
     */
    markAsRelationshipEntity() {
        this.isRelationshipEntity = true;
        return this;
    }

    /**
     * Check whether the entity has an index on the given fields
     * @param {array} fields
     * @returns {boolean}
     */
    hasIndexOn(fields) {
        fields = fields.concat();
        fields.sort();

        return _.findIndex(this.indexes, index => {
                return _.findIndex(index.fields, (f, idx) => (fields.length <= idx || fields[idx] !== f)) === -1;
            }) != -1;
    }

    /**
     * Add all indexes
     */
    addIndexes() {
        if (this.info.indexes) {
            _.each(this.info.indexes, index => {
                this.addIndex(index);
            });
        }
    }

    /**
     * Add an index
     * @param {object} index
     * @property {array} index.fields - Fields of the index
     * @property {bool} index.unique - Flag of uniqueness of the index
     * @returns {OolongEntity}
     */
    addIndex(index) {
        if (!this.indexes) {
            this.indexes = [];
        }

        index = OolUtils.deepClone(index);

        if (index.fields) {
            if (!_.isArray(index.fields)) {
                index.fields = [ index.fields ];
            }

            let fields = index.fields; //OolUtils.translateOolObj(index.fields);

            index.fields = _.map(fields, field => {

                let normalizedField = _.camelCase(field);

                if (!this.hasField(normalizedField)) {

                    throw new Error(`Index references non-exist field: ${field}, entity: ${this.name}.`);
                }

                return normalizedField;
            });

            index.fields.sort();

            if (this.hasIndexOn(index.fields)) {
                throw new Error(`Index on [${index.fields.join(', ')}] already exist in entity [${this.name}].`);
            }

            this.indexes.push(index);
        } else {
            console.log(index);
            throw new Error('error');
        }

        return this;
    }

    /**
     * Get a field object by field name or field accesor.
     * @param fieldId
     * @returns {OolongField}
     */
    getEntityAttribute(fieldId) {
        if (fieldId[0] === '$') {
            let token = fieldId.substr(1);

            switch (token) {
                case "key":
                    return this.fields[this.key];

                case 'feature':
                    return this.features;

                default:
                    throw new Error(`Filed accessor "${token}" not supported!`);
            }
        } else {
            if (!this.hasField(fieldId)) {
                throw new Error(`Field "${fieldId}" not exists in entity "${this.name}".`)
            }

            return this.fields[fieldId];
        }
    }

    /**
     * Check whether the entity has a field with given name
     * @param {string} name
     * @returns {boolean}
     */
    hasField(name) {
        return name in this.fields;
    }

    /**
     * Add a field into the entity
     * @param {string} name
     * @param {object} rawInfo
     * @returns {OolongEntity}
     */
    addField(name, rawInfo) {
        name = _.camelCase(name);
        
        if (this.hasField(name)) {
            throw new Error(`Field name [${name}] conflicts in entity [${this.name}].`);
        }

        if (rawInfo.type) {
            let fullRawInfo = this.linker.trackBackType(this.oolModule, rawInfo);
            
            this.fields[name] = new Field(name, fullRawInfo);

            if (!this.key) {
                this.key = name;
            }
        } else {
            //relation field
            if (!rawInfo.belongTo && !rawInfo.bindTo) {
                throw new Error(`Invalid field info of [${name}].`);
            }

            if (!this.oolModule.relation) {
                this.oolModule.relation = [];
            }

            let relationship, right;

            if (rawInfo.belongTo) {
                relationship = 'n:1';
                right = rawInfo.belongTo;
            } else {
                assert: rawInfo.bindTo, 'Invalid entity relation syntax!';

                relationship = '1:1';
                right = rawInfo.bindTo;
            }

            let relation = {
                left: this.name,
                leftField: name,
                right,
                relationship
            };

            if (rawInfo.optional) {
                relation.optional = true;
            }

            this.oolModule.relation.push(relation);
        }

        return this;
    }

    /**
     * Add a feature into the entity, e.g. auto increment id
     * @param {string} name
     * @param {*} feature
     * @param {bool} [allowMultiple=false] - Allow multiple occurrence
     * @returns {OolongEntity}
     */
    addFeature(name, feature, allowMultiple) {
        pre: {
            name, Util.Message.DBC_ARG_REQUIRED;
            feature, Util.Message.DBC_ARG_REQUIRED;
        }

        if (!this.features) {
            this.features = {};
        }

        if (allowMultiple) {
            if (!this.features[name]) {
                this.features[name] = [];
            }

            this.features[name].push(feature);
        } else {
            if (feature.name in this.features) {
                throw new Error(`Duplicate feature found: ${name}. Turn on allowMultiple to enable multiple occurrence of a feature.`);
            }
            this.features[name] = feature;
        }

        return this;
    }

    /**
     * Set key name
     * @param {string} name - Field name to be used as the key
     * @returns {OolongEntity}
     */
    setKey(name) {
        this.key = name;
        return this;
    }

    /**
     * Get key field 
     * @returns {*}
     */
    getKeyField() {
        return this.fields[this.key];
    }
 
    /**
     * Translate the entity into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return {            
            name: this.name,
            comment: this.comment,
            fields: _.reduce(this.fields, (r, v, k) => (r[k] = v.toJSON(), r), {}),
            features: this.features,
            key: this.key,
            indexes: this.indexes,
            isRelationshipEntity: this.isRelationshipEntity
        };
    }

    _inherit(baseEntity) {
        if (!baseEntity.initialized) {
            throw new Error('Extend from an uninitialized entity!');
        }

        let stack = new Map();

        this.fields = OolUtils.deepClone(baseEntity.fields, stack);

        if (baseEntity.features) {
            this.features = OolUtils.deepClone(baseEntity.features, stack);
        }

        if (baseEntity.key) {
            this.key = OolUtils.deepClone(baseEntity.key, stack);
        }

        if (baseEntity.indexes) {
            this.indexes = OolUtils.deepClone(baseEntity.indexes, stack);
        }
    }
}

module.exports = OolongEntity;
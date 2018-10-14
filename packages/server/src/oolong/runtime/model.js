"use strict";

const Mowa = require('../../server.js');
const Util = Mowa.Util;
const _ = Util._;
const OolUtil = require('../lang/ool-utils.js');

const { Errors, Validators, Generators, Features } = require('.');
const { ModelValidationError, ModelOperationError, ModelUsageError } = Errors;

class Model {
    /**
     * Model operator, provide CRUD functions
     *      
     * @constructs Model
     * @param {Object} [rawData] - Mapped object
     * @param {bool} [fromDb] - Flag showing the data is directed loaded from database
     */
    constructor(rawData, fromDb) {
        if (fromDb) {
            assert: !_.isEmpty(rawData);

            /**
             * Flag to mark as new Entity
             * @type {boolean}
             */
            this.isNew = false;

            this.pendingUpdate = new Set();

            this.oldData = rawData;

            this.data = new Proxy(Object.assign({}, rawData), {
                set: (obj, prop, value) => {
                    // Check whether it is a field of this model, ignore if it's not
                    if (!(prop in this.meta.fields)) return true;

                    obj[prop] = value;

                    // The default behavior to store the value
                    if (this.oldData[prop] != value) {
                        this.pendingUpdate.add(prop);
                    } else {
                        this.pendingUpdate.delete(prop);
                    }

                    // Indicate success
                    return true;
                }
            });
        } else {
            this.isNew = true;

            if (rawData) {
                //only pick those that are fields of this entity
                this.data = this.constructor._filterCondition(rawData);
            } else {
                this.data = {};
            }
        }       
    }    

    get db() {
        return this.constructor.db;
    }

    get meta() {
        return this.constructor.meta;
    }

    get keyName() {
        return this.meta.keyField;
    }

    get keyValue() {
        return this.data[this.keyName];
    }

    async save_() {
        return this.isNew ? 
            this.constructor.create_(this.data, { retrieveFromDb: true }) : 
            this.constructor.update_(_.pick(this.data, Array.from(this.pendingUpdate)), { retrieveFromDb: true });
    }    

    /**
     * Populate data from database
     * @param {*} data 
     */
    static fromDb(data) {
        let ModelClass = this;
        return new ModelClass(data, true);
    }
    
    /**
     * Find one record, returns a model object containing the record or undefined if nothing found.
     * @param {*} condition - Primary key value or query condition with unique key values.
     * @returns {*}
     */
    static async findOne_(condition) {     
        pre: !_.isNil(condition), '"findOne_()" requires condition to be not null.';

        if (!_.isPlainObject(condition)) {
            //todo：combination key support 
            condition = { [ this.meta.keyField ]: condition };
        } else {
            // check whether contains unique field
            //todo: foreign entity joined query
            condition = this._ensureContainsUniqueKey(condition);                   
        }

        let record = await this._doFindOne_(condition);
        if (!record) return undefined;

        return this.fromDb(record);
    }

    /**
     * Find records matching the condition, returns an array of model object or an array of records directly if fetchArray = true.
     * @param {object|array} condition - Query condition, key-value pair will be joined with 'AND', array element will be joined with 'OR'.
     * @param {boolean} [fetchArray=false] - When fetchArray = true, the result will be returned directly without creating model objects.
     * @returns {array}
     */
    static async find_(condition, fetchArray = false) {
        pre: _.isPlainObject(condition) || Array.isArray(condition), '"find()" requires condition to be a plain object or an array.';

        let records = await this._doFind_(this._filterCondition(condition));
        if (!records) return undefined;

        if (fetchArray) return records;

        return records.map(row => this.fromDb(row));
    }

    /**
     * Create a new entity with given data
     * @param {object} data - Entity data 
     * @param {object} [options] - Create options
     * @property {bool} [options.ignoreDuplicate] - Ignore duplicate error
     * @property {bool} [options.retrieveFromDb] - Retrieve the created entity from database
     * @returns {object}
     */
    static async create_(data, options) {
        let context = await this._validateAndFill_(data, true);              

        this._mergeOptionsInContext(context, options);

        OolUtil.applyFeature(OolUtil.RULE_POST_CREATE_CHECK, this.meta, context, this.db);
        
        let result = await this._doCreate_(context);
        console.log(result);
        return this.fromDb(result);
    }

    /**
     * Update an existing entity with given data
     * @param {object} data - Entity data with at least one unique key (pair) given
     * @param {object} [options] - Update options
     * @property {bool} [options.throwZeroUpdate=false] - Throw error if no row is updated
     * @property {bool} [options.retrieveFromDb=false] - Retrieve the updated entity from database
     * @returns {object}
     */
    static async update_(data, options) {
        let context = await this._validateAndFill_(data);      
        
        this._mergeOptionsInContext(context, options);

        OolUtil.applyFeature(OolUtil.RULE_POST_UPDATE_CHECK, this.meta, context, this.db);

        let result = await this._doUpdate_(context);
        return this.fromDb(result);
    }

    /**
     * Find a record or create a new one if not exist.
     * @param {*} condition 
     * @param {object} data 
     * @returns {Model}
     */
    static async findOrCreate_(condition, data) {
        let record = this.findOne_(condition);
        if (record) return record;


    }

    /**
     * Remove one record.
     * @param {*} condition 
     */
    static async removeOne_(condition) {
        pre: !_.isNil(condition), '"removeOne()" requires condition to be not null.';

        if (!_.isPlainObject(condition)) {
            //todo：combination key support
            condition = { [ this.meta.keyField ]: condition };
        } else {
            // check whether contains unique field
            //todo: foreign entity joined query
            condition = this._ensureContainsUniqueKey(condition);                   
        }        
        
        return await this._doRemoveOne_(condition);
    }

    static _ensureContainsUniqueKey(condition) {
        condition = this._filterCondition(condition, true);
        let containsUniqueKey = _.find(this.meta.uniqueKeys, fields => {
            let containsAll = true;
            fields.forEach(f => {
            if (_.isNil(condition[f]))
                containsAll = false;
            });
            return containsAll;
        });

        if (!containsUniqueKey) {
            throw new ModelUsageError('Unexpected usage.', { 
                    entity: this.meta.name, 
                    reason: 'Single record operation requires condition to be containing unique key.',
                    condition
                }
            );
        }

        return condition;
    }

    static _getUniqueKeyPairFrom(condition) {        
        return _.find(this.meta.uniqueKeys, fields => {
            let containsAll = true;
            fields.forEach(f => {
            if (_.isNil(condition[f]))
                containsAll = false;
            });
            return containsAll;
        });
    }

    static async _validateAndFill_(raw, isNew = false) {
        let meta = this.meta;
        let fields = meta.fields;        
        let errors = [];
        let latest = {};

        let context = {
            raw,
            latest,
            errors
        };

        for (let fieldName in fields) {
            let fieldMeta = fields[fieldName];

            if (fieldName in raw) {
                //field value given in raw data
                if (fieldMeta.readOnly) {
                    //read only, not allow to set by input value
                    throw new ModelValidationError('Read-only field is not allowed to be set by manual input.', {
                        entity: this.meta.name,                        
                        fieldInfo: fieldMeta 
                    });
                } else if (!isNew && fieldMeta.fixedValue) {
                    //update a fixedValue field
                    if (!_.isNil(context.existing[fieldName])) {
                        throw new ModelValidationError('Write-once-only field is not allowed to be update once it was set.', {
                            entity: this.meta.name,                            
                            fieldInfo: fieldMeta 
                        });
                    }                                        
                } 
                
                //sanitize first
                let sanitizeState = Validators.$sanitize(fieldMeta, raw[fieldName]);
                latest[fieldName] = sanitizeState.sanitized;                
                continue;                
            }

            //not given in raw data
            if (isNew) {
                if (!fieldMeta.defaultByDb) {
                    if ('default' in fieldMeta) {
                        //has default setting in meta data
                        latest[fieldName] = fieldMeta.default;
                    } else if (fieldMeta.auto) {
                        latest[fieldName] = await Generators.$auto(fieldMeta, (this.db.ctx && this.db.ctx.__) || this.db.appModule.__);
                    } else if (!fieldMeta.optional) {
                        errors.push({field: fieldMeta, message: 'Missing required field.'});
                        return context;
                    }
                }
            } else {
                if (fieldMeta.fixedValue && !_.isNil(context.existing[fieldName])) {
                    //already write once
                    continue;
                }

                if (fieldMeta.forceUpdate) {
                    //has force update policy, e.g. updateTimestamp
                    if (fieldMeta.updateByDb) {
                        continue;
                    }

                    //require generator to refresh auto generated value
                    if (fieldMeta.auto) {
                        latest[fieldName] = await Generators.$auto(fieldMeta, (this.db.ctx && this.db.ctx.__) || this.db.appModule.__);
                        continue;
                    } 

                    throw new ModelUsageError(
                        'Unknow force update rule.', {         
                            entity: this.meta.name,                                               
                            fieldInfo: fieldMeta
                        }
                    );          
                }
            }
        }

        OolUtil.applyFeature(OolUtil.RULE_POST_RAW_DATA_PRE_PROCESS, meta, context, this.db);        

        return this._doValidateAndFill_(context);
    }

    /**
     * Filter non-field condition
     * @param {*} condition     
     * @param {bool} [nonEmpty=false] - Require the condition to be non-empty, e.g. findOne
     */
    static _filterCondition(condition, nonEmpty) {
        let fields = Object.keys(this.meta.fields);        

        if (_.isPlainObject(condition)) {
            condition = _.pick(condition, fields);
        } else if (Array.isArray(condition)) {
            condition = condition.map(c => this._filterCondition(c, fields));
        }        

        if (nonEmpty && _.isEmpty(condition)) {
            throw new ModelUsageError('Empty condition.', {
                entity: this.meta.name
            });
        }

        return condition;
    }    

    static _mergeOptionsInContext(context, options) {
        if (options) {
            _.forOwn(options, (v, k) => { context['$'+k] = v });
        }
    }
}

module.exports = Model;
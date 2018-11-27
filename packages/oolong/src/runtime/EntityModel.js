"use strict";

const Util = require('rk-utils');
const { _ } = Util._;

const { Errors, Validators, Generators, sanitize } = require('.');
const { DataValidationError, OolongUsageError, DsOperationError } = Errors;
const Features = require('./Features');

const { isNothing } = require('../utils/lang');

/**
 * Base entity model class.
 * @class
 */
class EntityModel {
    /**     
     * @param {Object} [rawData] - Raw data object 
     */
    constructor(rawData) {
        if (rawData) {
            //only pick those that are fields of this entity
            Object.assign(this, this.constructor._filterFields(rawData));
        } 
    }    

    get $connector() {
        return this.constructor.connector;
    }

    get $meta() {
        return this.constructor.meta;
    }

    get $pk() {
        return this.$meta.keyField;
    }

    get $pkValue() {
        return Array.isArray(this.$pk) ? _.pick(this, this.$pk) : this[this.$pk];
    }

    get $hasPkValue() {
        return Array.isArray(this.$pk) ? 
            _.every(this.$pk, k => !isNothing(this[k])) :
            !isNothing(this[this.$pk]);
    }

    async save_() {
        if (this.$hasPkValue) {
            return this.constructor.replace_(this);
        } 

        return this.constructor.create_(this);
    }    

    /**
     * Populate data from database.
     * @param {*} data 
     * @return {EntityModel}
     */
    static populate(data) {
        let ModelClass = this;
        return new ModelClass(data);
    }

    /**
     * Get a unique key pair from input data.
     * @param {object} data - Input data.
     */
    static getUniqueKeyPairFrom(data) {  
        pre: _.isPlainObject(data);    
        
        return _.find(this.meta.uniqueKeys, fields => {
            let containsAll = true;
            fields.forEach(f => {
            if (_.isNil(data[f]))
                containsAll = false;
            });
            return containsAll;
        });
    }

    /**
     * Prepare valid and sanitized entity data for sending to database.
     * @param {object} context - Operation context.
     * @property {object} context.raw - Raw input data.
     * @param {object} options - Operation options.
     * @property {bool} [options.forUpdate=false] - Flag for new entity.
     */
    static async prepareEntityData_(context, { forUpdate }) {
        let meta = this.meta;
        let i18n = this.i18n;
        let { name, fields } = meta;        

        let latest = {}, existing;
        context.latest = latest;       

        if (!context.i18n) {
            context.i18n = i18n;
        }

        if (forUpdate && meta.knowledge.dependsOnExisting(raw)) {
            let condition = this.getUniqueKeyPairFrom(raw);
            if (!condition) {
                throw new DataValidationError(`Input data for updating "${name}" does not contain any unique key values which is required to perform an update.`, {
                    entity: name,                        
                    fieldInfo: fieldInfo 
                });
            }

            let connector = context.connector;

            if (!connector) {
                connector = this.dataSource.getNewConnector();
                await connector.beginTransaction_();
                context.connector = connector;
            } // else already in a transaction                        

            existing = this.findOne_(condition, connector);            
            context.existing = existing;            
        }        

        await Util.eachAsync_(fields, async (fieldInfo, fieldName) => {
            if (fieldName in raw) {
                //field value given in raw data
                if (fieldInfo.readOnly) {
                    //read only, not allow to set by input value
                    throw new DataValidationError('Read-only field is not allowed to be set by manual input.', {
                        entity: name,                        
                        fieldInfo: fieldInfo 
                    });
                }  

                if (forUpdate && fieldInfo.writeOnce) {       
                    assert: existing; 

                    if (existing && !_.isNil(existing[fieldName])) {
                        throw new DataValidationError('Write-once field is not allowed to be update once it was set.', {
                            entity: name,
                            fieldInfo: fieldInfo 
                        });
                    }
                } 
                
                //sanitize first
                latest[fieldName] = sanitize(raw[fieldName], fieldInfo, i18n);
                return;
            }

            //not given in raw data
            if (existing) {
                if (fieldInfo.writeOnce && !_.isNil(existing[fieldName])) {
                    //already written once
                    return;
                }

                if (fieldInfo.forceUpdate) {
                    //has force update policy, e.g. updateTimestamp
                    if (fieldInfo.updateByDb) {
                        return;
                    }

                    //require generator to refresh auto generated value
                    if (fieldInfo.auto) {
                        latest[fieldName] = await Generators.$auto(fieldInfo, i18n);
                        return;
                    } 

                    throw new DataValidationError(
                        `"${fieldName}" of "${name}" enttiy is required for each update.`, {         
                            entity: name,                                               
                            fieldInfo: fieldInfo
                        }
                    );          
                }
            } else {    
                if (!fieldInfo.createByDb) {
                    if (fieldInfo.hasOwnProperty('default')) {
                        //has default setting in meta data
                        latest[fieldName] = fieldInfo.default;

                    } else if (fieldInfo.auto) {
                        //automatically generated
                        latest[fieldName] = await Generators.$auto(fieldInfo, i18n);

                    } else if (!fieldInfo.optional) {
                        //missing required
                        throw new DataValidationError(`"${fieldName}" of "${name}" enttiy is required.`, {
                            entity: name,
                            fieldInfo: fieldInfo 
                        });
                    }
                } // else default value set by database
            } 
        });

        await Features.applyRules_(Features.RULE_POST_DATA_VALIDATION, meta, context);    

        return context;
    }
    
    /**
     * Find one record, returns a model object containing the record or undefined if nothing found.
     * @param {*} condition - Primary key value or query condition with unique key values.
     * @param {Connector} - Use passed in connector.
     * @returns {*}
     */
    static async findOne_(condition, select, options) {     
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
    static async findAll_(condition, fetchArray = false) {
        pre: _.isPlainObject(condition) || Array.isArray(condition), '"find()" requires condition to be a plain object or an array.';

        let records = await this._doFind_(this._filterCondition(condition));
        if (!records) return undefined;

        if (fetchArray) return records;

        return records.map(row => this.fromDb(row));
    }

    /**
     * Create a new entity with given data.
     * @param {object} data - Entity data 
     * @param {object} [options] - Create options
     * @property {Connector} [options.connector] - Transaction connector if in a transaction.
     * @returns {EntityModel}
     */
    static async create_(data, options) {
        let context = { raw: data };
        let inTransaction = false;

        if (options && options.connector) {
            context.connector = options.connector;
            inTransaction = true;
        }

        return this.safeExecute_(async (context) => {
            await this.prepareEntityData_(context);          

            await Features.applyRules_(Features.RULE_POST_CREATE_CHECK, this.meta, context);
    
            let connector = context.connector || this.dataSource.defaultConnector;
            
            return this.populate(await connector.create_(this.meta.name, context.latest));
        }, inTransaction);
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

        await Features.applyRules_(Features.RULE_POST_CREATE_CHECK, this.meta, context);

        let result = await this._doUpdate_(context);
        return this.fromDb(result);
    }

    /**
     * Find a record or create a new one if not exist.
     * @param {*} condition 
     * @param {object} data 
     * @returns {EntityModel}
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

    /**
     * Extract fields from given data record.
     * @param {object} data 
     * @returns {object}    
     */
    static _filterFields(data) {
        let fields = Object.keys(this.meta.fields);        

        //todo: embedded entity support

        return _.pick(data, fields);
    }    

    static async doCreate_(context) {
        await this.prepareEntityData_(context);          

        Features.applyRule(Features.RULE_POST_CREATE_CHECK, this.meta, context);

        let connector = context.connector || this.dataSource.defaultConnector;
        
        return connector.create_(this.meta.name, context.latest);
    }

    static async safeExecute_(executor, context, alreadyInTransaction = false) {
        executor =  executor.bind(this);

        if (alreadyInTransaction) {
             return executor(context);
        } 

        try {
            await executor(context);
            
            //if the executor have initiated a transaction
            context.connector && await context.connector.commit_();                

            return context.result;
        } catch (error) {
            //we have to rollback if error occurred in a transaction
            context.connector && await context.connector.rollback_();                

            throw error;
        } finally {
            context.connector && await context.connector.end_();
        }
    }
}

module.exports = EntityModel;
"use strict";

const Model = require('../model.js');

const Mowa = require('../../../server.js');
const Util = Mowa.Util;
const _ = Util._;
const OolUtil = require('../../lang/ool-utils.js');

const Errors = require('../errors.js');

class MysqlModel extends Model {
    /**
     * Create a new entity with given data
     * @param {object} context - Operation context
     * @property {object} context.raw - Raw inputs
     * @property {object} context.latest - Latest data entry, pass basic validation and sanitization, auto pre-filled     
     * @property {bool} context.$ignoreDuplicate - Ignore duplicate error
     * @property {bool} context.$retrieveFromDb - Retrieve the created entity from database
     * @returns {object}
     */
   static async _doCreate_(context) {
        let sql = 'INSERT INTO ?? SET ?';
        let values = [ this.meta.name ];
        values.push(context.latest);

        let conn = await this.db.conn_();
        sql = conn.format(sql, values);
                
        if (this.db.appModule.oolong.logSqlStatement) {
            this.db.appModule.log('verbose', sql);
        }

        let result;

        try {
            [ result ] = await this.db.query_(sql);
        } catch (error) {
            if (error.code && error.code === 'ER_DUP_ENTRY') {
                if (!context.$ignoreDuplicate) {
                    let field = error.message.split("' for key '").pop();
                    field = field.substr(0, field.length-1);

                    throw new Errors.ModelValidationError(error.message, { 
                        code: error.code, 
                        sqlMessage: error.sqlMessage,
                        entity: this.meta.name,
                        fieldInfo: this.meta.fields[field] 
                    });
                } else {
                    context.$hasDuplicate = true;
                }
            } else {
                throw error;
            }
        }
        
        if (result.affectedRows !== 1 && !context.$hasDuplicate) {
            throw new Errors.ModelOperationError('Insert operation may fail. "affectedRows" is 0.', result);
        }        

        let autoIdFeature = this.meta.features.autoId;
        if (autoIdFeature && this.meta.fields[autoIdFeature.field].autoIncrementId) {              
            if (!context.$hasDuplicate) {
                if ('insertId' in result) {
                    if (context.$retrieveFromDb) {
                        return this._doFindOne_({[autoIdFeature.field]: result.insertId });
                    }
                    context.latest[autoIdFeature.field] = result.insertId;            
                } else {
                    throw new Errors.ModelOperationError('Last insert id does not exist in result record.', result);
                }
            } // if hasDuplicate, the latest record will not 
        } 

        if (!context.$retrieveFromDb) {
            return context.latest;
        }
        
        return this._doFindOne_(_.pick(context.latest, this._getUniqueKeyPairFrom(context.latest)));
    }
    
    /**
     * Update an entity with given data
     * @param {object} condition - Query conditions
     * @param {object} context - Operation context
     * @property {object} context.raw - Raw inputs
     * @property {object} context.latest - Latest data entry, pass basic validation and sanitization, auto pre-filled     
     * @property {bool} context.$throwZeroUpdate - Throw error when no rows being updated
     * @property {bool} context.$retrieveFromDb - Retrieve the created entity from database
     * @returns {object}
     */
    static async _doUpdate_(condition, context) {
        let conn = await this.db.conn_();
        
        let values = [ this.meta.name, context.latest ]; 
        
        let ld = this.meta.features.logicalDeletion;
        if (ld) {
            condition = { $and: [ { $not: { [ld.field]: ld.value } }, condition ] };
        }

        let whereClause = this._joinCondition(conn, condition, values);        

        let sql = 'UPDATE ?? SET ? WHERE ' + whereClause;
        sql = conn.format(sql, values);

        if (this.db.appModule.oolong.logSqlStatement) {
            this.db.appModule.log('verbose', sql);
        }

        let [ result ] = await this.db.query_(sql);

        if (result.affectedRows === 0 && context.$throwZeroUpdate) {
            throw new Errors.ModelOperationError('Update operation may fail. "affectedRows" is 0.', result);
        }

        if (context.$retrieveFromDb) {
            return this._doFindOne_(_.pick(context.latest, this._getUniqueKeyPairFrom(context.latest)));
        }

        return Object.assign({}, context.raw, context.latest);
    }

    /**
     * 
     * @param {object} condition - Query conditions
     */
    static async _doFindOne_(condition) {
        let conn = await this.db.conn_();
        
        let values = [ this.meta.name ];       
        
        let ld = this.meta.features.logicalDeletion;
        if (ld) {
            condition = { $and: [ { $not: { [ld.field]: ld.value } }, condition ] };
        }

        let whereClause = this._joinCondition(conn, condition, values);        
        assert: whereClause, 'Invalid condition';

        let sql = 'SELECT * FROM ?? WHERE ' + whereClause;
        sql = conn.format(sql, values);

        if (this.db.appModule.oolong.logSqlStatement) {
            this.db.appModule.log('verbose', sql);
        }

        let [rows] = await this.db.query_(sql);

        return rows.length > 0 ? rows[0] : undefined;
    }

    static async _doFind_(condition) {
        let conn = await this.db.conn_();

        let values = [ this.meta.name ];

        let ld = this.meta.features.logicalDeletion;
        if (ld) {
            condition = { $and: [ { [ld.field]: ld.value }, condition ] };
        }

        let whereClause = this._joinCondition(conn, condition, values);
        
        let sql = 'SELECT * FROM ??';
        if (whereClause) {
            sql += ' WHERE ' + whereClause;
        }

        sql = conn.format(sql, values);

        if (this.db.appModule.oolong.logSqlStatement) {
            this.db.appModule.log('verbose', sql);
        }

        let [ rows ] = await this.db.query_(sql);

        return rows;
    }

    static async _doRemoveOne_(condition) {
        let conn = await this.db.conn_();

        let values = [ this.meta.name ];

        let whereClause = this._joinCondition(conn, condition, values);
        
        let sql;
        
        if (this.meta.features.logicalDeletion) {
            let fieldName = this.meta.features.logicalDeletion.field;
            let fieldValue = this.meta.features.logicalDeletion.value; 
            sql = 'UPDATE ?? SET ? WHERE ' + whereClause;
            values.splice(1, 0, { [fieldName]: fieldValue });
            
        } else {
            sql = 'DELETE FROM ?? WHERE ' + whereClause;
        }
        
        sql = conn.format(sql, values);

        if (this.db.appModule.oolong.logSqlStatement) {
            this.db.appModule.log('verbose', sql);
        }

        let [ result ] = await this.db.query_(sql);

        if (result.affectedRows !== 1) {
            throw new Errors.ModelOperationError('Delete operation may fail. "affectedRows" is 0.', result);
        }

        return true;
    }

    /**
     * SQL condition representation
     *   Rules:
     *     default: 
     *        array: OR
     *        kv-pair: AND
     *     $and: 
     *        array: AND
     *     $or:
     *        kv-pair: OR
     *     $not:
     *        array: not ( or )
     *        kv-pair: not ( and )
     * @param {object} conn 
     * @param {object} condition 
     * @param {array} valuesSeq 
     */
    static _joinCondition(conn, condition, valuesSeq, joinOperator) {
        if (Array.isArray(condition)) {
            if (!joinOperator) {
                joinOperator = 'OR';
            }
            return condition.map(c => this._joinCondition(conn, c, valuesSeq)).join(` ${joinOperator} `);
        }

        if (_.isPlainObject(condition)) { 
            if (!joinOperator) {
                joinOperator = 'AND';
            }
            
            return _.map(condition, (value, key) => {
                if (key === '$and') {
                    assert: Array.isArray(value), '"$and" operator value should be an array.';                    

                    return this._joinCondition(conn, value, valuesSeq, 'AND');
                }
    
                if (key === '$or') {
                    assert: _.isPlainObject(value), '"$or" operator value should be a plain object.';       
                    
                    return this._joinCondition(conn, value, valuesSeq, 'OR');
                }

                if (key === '$not') {                    
                    if (Array.isArray(value)) {
                        assert: value.length > 0, '"$not" operator value should be non-empty.';                     

                        return 'NOT (' + this._joinCondition(conn, value, valuesSeq) + ')';
                    } else if (_.isPlainObject(value)) {
                        let numOfElement = Object.keys(value).length;   
                        assert: numOfElement > 0, '"$not" operator value should be non-empty.';                     

                        if (numOfElement === 1) {
                            let keyOfElement = Object.keys(value)[0];
                            let valueOfElement = value[keyOfElement];

                            return this._wrapCondition(conn, keyOfElement, valueOfElement, valuesSeq, true);
                        }

                        return 'NOT (' + this._joinCondition(conn, value, valuesSeq) + ')';
                    } 

                    assert: typeof value === 'string', 'Unsupported condition!';

                    return 'NOT (' + condition + ')';                    
                }

                return this._wrapCondition(conn, key, value, valuesSeq);
            }).join(` ${joinOperator} `);
        }

        assert: typeof condition === 'string', 'Unsupported condition!';

        return condition;
    }

    /**
     * Wrap a condition clause
     * @param {object} conn 
     * @param {string} key 
     * @param {*} value 
     * @param {array} valuesSeq 
     * @param {bool} [not=false] 
     */
    static _wrapCondition(conn, key, value, valuesSeq, not = false) {
        if (_.isNil(value)) {
            return conn.escapeId(key) + (not ? 'IS NOT NULL' : ' IS NULL');
        }

        valuesSeq.push(value);
        return conn.escapeId(key) + ' ' + (not ? '<>' : '=') + ' ?';
    }
}

module.exports = MysqlModel;
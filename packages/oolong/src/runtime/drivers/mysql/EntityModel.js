"use strict";

const Util = require('rk-utils');
const { _ } = Util;

const EntityModel = require('../../EntityModel');
const Errors = require('../../Errors');

/**
 * MySQL entity model class.
 */
class MySQLEntityModel extends EntityModel {
    /**
     * Create a new entity with given data
     * @param {object} context - Operation context
     * @property {object} context.raw - Raw inputs
     * @property {object} context.latest - Latest data entry, pass basic validation and sanitization, auto pre-filled     
     * @property {bool} context.$ignoreDuplicate - Ignore duplicate error
     * @property {bool} context.$retrieveFromDb - Retrieve the created entity from database
     * @returns {object}
     */
   static async create_(options) {       

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
}

module.exports = MySQLEntityModel;
"use strict";

const Util = require('rk-utils');
const { _ } = Util;

const { DateTime } = require('luxon');
const EntityModel = require('../../EntityModel');

/**
 * MySQL entity model class.
 */
class MySQLEntityModel extends EntityModel {    
    static get hasAutoIncrement() {
        let autoId = this.meta.features.autoId;
        return autoId && this.meta.fields[autoId.field].autoIncrementId;    
    }

    /**
     * Serialize value into database acceptable format.
     * @param {object} dataRecord 
     */
    static serialize(dataRecord) {
        _.forOwn(dataRecord, (value, fieldName) => {
            let fieldMeta = this.meta.fields[fieldName];
            
            if (fieldMeta.type === 'datetime' && value instanceof DateTime) {
                dataRecord[fieldName] = value.toISO({ includeOffset: false });
            }
        });
    }

    /**
     * Post create processing.
     * @param {*} context 
     * @property {object} [context.createOptions] - Create options     
     * @property {bool} [createOptions.$retrieveCreated] - Retrieve the newly created record from db. 
     */
    static async afterCreate_(context) {
        if (this.hasAutoIncrement) {
            let { insertId } = context.result;
            context.latest[this.meta.features.autoId.field] = insertId;
        }

        if (context.createOptions.$retrieveCreated) {
            let condition = this.getUniqueKeyValuePairsFrom(context.latest);
            context.latest = await this.findOne_({ $where: condition, $fetchArray: true}, context.connOptions);
        }
    }

    /**
     * Post update processing.
     * @param {*} context 
     * @param {object} [updateOptions] - Update options     
     * @property {bool} [updateOptions.$retrieveUpdated] - Retrieve the newly updated record from db. 
     */
    static async afterUpdate_(context) {
        if (context.updateOptions.$retrieveUpdated) {            
            context.latest = await this.findOne_({ $where: context.updateOptions.$where, $fetchArray: true}, context.connOptions);
        }
    }

    /**
     * Before deleting an entity.
     * @param {*} context 
     * @property {object} [context.deleteOptions] - Delete options     
     * @property {bool} [deleteOptions.$retrieveDeleted] - Retrieve the recently deleted record from db. 
     */
    static async beforeDelete_(context) {
        if (context.deleteOptions.$retrieveDeleted) {            
            if (!context.connOptions || !context.connOptions.connection) {
                context.connOptions || (context.connOptions = {});

                context.connOptions.connection = await this.db.connector.beginTransaction_();                           
            }
            
            context.existing = await this.findOne_({ $where: context.deleteOptions.$where, $fetchArray: true}, context.connOptions);
        }
    }
}

module.exports = MySQLEntityModel;
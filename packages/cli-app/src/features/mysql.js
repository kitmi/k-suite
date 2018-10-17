"use strict";

/**
 * Enable mysql access as a service.
 * @module Feature_MySQL
 */

const Feature = require('../enum/Feature');
const mysql = require('mysql2/promise');
const _ = require('rk-utils')._;
const DbService = require('../DbService');

const poolByConn = {};

/**
 * MySQL Service.
 * @class
 * @extends DbService
 */
class MySQLService extends DbService {
    /**     
     * @param {CliApp} app 
     * @param {string} name 
     * @param {object} options 
     */
    constructor(app, name, options) {
        super(app, 'mysql', name, options);
    }

    /**
     * Get a database connection     
     * @param {Object} [options] - Extra options for the connection, optional
     * @returns {Promise.<MySQLConnection>}
     */
    async getConnection_(options) {
        let pool = poolByConn[this.connectionString];

        if (!pool) {
            pool = poolByConn[this.connectionString] = mysql.createPool(this.connectionString);

            this.appModule.on('stopping', () => {
                pool.end();
            });
        }        

        return pool.getConnection();
    }

    /**
     * Close a database connection     
     * @param {MySQLConnection} conn
     */
    closeConnection(conn) {
        return conn.release();
    }

    /**
     * Start a transaction.
     * @param {DbConnection} conn 
     */
    async startTransaction_(conn) {   
        let [ result ] = await conn.query('START TRANSACTION;');
        return result;
    }

    /**
     * Commit a transaction.
     * @param {DbConnection} conn 
     */
    async commitTransaction_(conn) {      
        let [ result ] = await conn.query('COMMIT;');
        return result;
    }

    /**
     * Rollback a transaction
     * @param {DbConnection} conn 
     */
    async rollbackTransaction_(conn) {
        let [ result ] = await conn.query('ROLLBACK;');
        return result;
    }
}

module.exports = {
    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.SERVICE,

    /**
     * Load the feature
     * @param {CliApp} app - The app module object
     * @param {object} dbs - Mysql db and its setting
     * @returns {Promise.<*>}
     */
    load_: function (app, dbs) {
        _.forOwn(dbs, (opt, db) => {
            if (!opt.connection) {
                throw new Error(`Missing connection string for MySQL db "${db}".`);
            }

            let service = new MySQLService(app, db, opt);
            app.registerService(service.serviceId, service);
        });
    }
};
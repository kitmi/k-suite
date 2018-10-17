"use strict";

const { URL } = require('url');

/**
 * A database service object
 * @class
 */
class DbService {
    /**
     * @param {CliApp} app - The app which creates this service
     * @param {string} type - Dbms type
     * @param {string} name - The name of database (the one appears as the key of db config)
     * @param {object} [options] - Options loaded from feature config
     * @property {object} [options.spec] - Dbms specifications
     * @property {string} options.connection - The connection string
     */
    constructor(app, type, name, options) {
        /**
         * The owner app.
         * @member {CliApp}
         */
        this.appModule = app;

        /**
         * The database type, e.g. mysql, mongodb
         * @member {string}
         */
        this.dbType = type;

        /**
         * Extra db spec, used for reverse engineering or code generation.
         * @member {object}
         */
        this.dbmsSpec = options.spec;

        /**
         * Database service name, may be not the same with the real database name.
         * @member {string}
         */
        this.name = name;

        /**
         * Service id.
         * @member {string}
         */
        this.serviceId = type + ':' + name;

        /**
         * URL like connection string, e.g. mysql://username:password@host:port/dbname
         * @member {string}
         */
        this.connectionString = options.connection;               
    }
    
    /**
     * Extracted connection string components.
     * @member {URL}
     */
    get connectionComponents() {
        if (!this._connUrlObj) {
            this._connUrlObj = new URL(this.connectionString);
        }

        return this._connUrlObj;
    }  

    /**
     * Database name.
     * @member {string}
     */
    get dbName() {
        return this.connectionComponents.pathname.substr(1);
    }

    /**
     * Get a database connection     
     * @param {Object} [options] - Extra options for the connection, optional
     * @returns {Promise.<object>}
     */
    async getConnection_(options) {
    }

    /**
     * Close a database connection     
     * @param {Object} conn
     */
    closeConnection(conn) {
    }

    /**
     * Start a transaction.
     * @param {DbConnection} conn 
     */
    async startTransaction_(conn) {   
    }

    /**
     * Commit a transaction.
     * @param {DbConnection} conn 
     */
    async commitTransaction_(conn) {  
    }

    /**
     * Rollback a transaction
     * @param {DbConnection} conn 
     */
    async rollbackTransaction_(conn) {
    }
}

module.exports = DbService;

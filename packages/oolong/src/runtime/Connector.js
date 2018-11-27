"use strict";

const { URL } = require('url');
const { _ } = require('rk-utils');
const { makeDataSourceName, SupportedDrivers } = require('../utils/lang');

/**
 * A database storage connector object.
 * @class
 */
class Connector {
    static createConnector(driver, name, options) {
        if (SupportedDrivers.indexOf(driver) === -1) {
            throw new Error(`Unsupported connector driver: "${driver}"!`);
        }

        if (!options || !options.connection) {
            throw new Error(`Missing required connection string for connector: "${makeDataSourceName(driver, name)}"!`);
        }

        let ConnectorClass = require(`./drivers/${driver}/Connector`);
        return new ConnectorClass(name, options);
    }

    /**     
     * @param {string} driver - Data storage type
     * @param {string} name - The name of data storage (the one appears as the key of data storage config)
     * @param {object} [options] - Options loaded from feature config     
     * @property {string} options.connection - The connection string
     */
    constructor(driver, name, { connection, ...extraOptions }) {
        /**
         * The database storage type, e.g. mysql, mongodb
         * @member {string}
         */
        this.driver = driver;

        /**
         * Database service name, may be not the same with the real database name.
         * @member {string}
         */
        this.name = name;   
        
        /**
         * URL style connection string, e.g. mysql://username:password@host:port/dbname
         * @member {string}
         */
        this.connectionString = connection;

        /**
         * Connector options
         * @member {object}
         */
        this.options = extraOptions || {};          
    }

    /**
     * Create a new connector instance with the same settings
     * @returns {Connector}
     */
    createNew() {
        let ConnectorClass = this.constructor;
        return new ConnectorClass(this.driver, this.name, { 
            connection: this.connectionString,
            ... this.options
        });
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
     * Update connection components.
     * @param {*} components 
     */
    updateConnectionComponents(components) {
        pre: _.isPlainObject(components);

        let old = this.connectionComponents;

        if (components.hasOwnProperty('username')) {
            old.username = components['username'];
        }

        if (components.hasOwnProperty('password')) {
            old.password = components['password'];
        }

        if (components.hasOwnProperty('database')) {
            old.pathname = '/' + components['database'];
        }        

        if (components.hasOwnProperty('options')) {
            let options = components.options;

            _.forOwn(options, (value, key) => {
                old.searchParams.set(key, value);
            });
        }

        return (this.connectionString = old.href);
    }

    /**
     * Get connection option.
     * @param {string} name - Option name. 
     */
    getConnectionOption(name) {
        return this.connectionComponents.searchParams.get(name);
    }

    /**
     * Database name.
     * @member {string}
     */
    get database() {
        if (!this._database) {
            this._database = this.connectionComponents.pathname.substr(1);
        }

        return this._database;
    }

    /**
     * Write log.
     * @param  {...any} args 
     */
    log(...args) {
        if (this.options.logger) {
            this.options.logger.log(...args);
        }
    }

    mergeWhere(filters, where) {
        if (!filters.where) {
            filters.where = _.cloneDeep(where);
        } else {
            filters.where = { $and: [ filters.where, _.cloneDeep(where) ] };
        } 
    }

    /**
     * Log query.
     */

    /*
    async connect_() {}

    async disconnect_() {}

    async ping_() {}

    async execute_() {}

    async end_() {}
    */
}

module.exports = Connector;
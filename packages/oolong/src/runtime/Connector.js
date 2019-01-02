"use strict";

const { URL } = require('url');
const { _ } = require('rk-utils');
const { SupportedDrivers } = require('../utils/lang');

/**
 * A database storage connector object.
 * @class
 */
class Connector {
    static createConnector(driver, connectionString, options) {
        if (SupportedDrivers.indexOf(driver) === -1) {
            throw new Error(`Unsupported connector driver: "${driver}"!`);
        }

        if (!connectionString) {
            throw new Error(`Missing required connection string`);
        }

        let ConnectorClass = require(`./drivers/${driver}/Connector`);
        return new ConnectorClass(connectionString, options);
    }

    /**     
     * @param {string} driver - Data storage type
     * @param {string} connectionString - The connection string
     * @param {object} [options] - Extra connector options
     */
    constructor(driver, connectionString, options) {
        /**
         * The database storage type, e.g. mysql, mongodb
         * @member {string}
         */
        this.driver = driver;

        /**
         * The default URL style connection string, e.g. mysql://username:password@host:port/dbname
         * @member {string}
         */
        this.connectionString = connectionString;

        /**
         * Connector options
         * @member {object}
         */
        this.options = options || {};          
    }

    /**
     * Update connection components.
     * @param {*} components 
     */
    getNewConnectionString(components) {
        pre: _.isPlainObject(components);

        let url = new URL(this.connectionString);

        if (components.hasOwnProperty('username')) {
            url.username = components['username'];
        }

        if (components.hasOwnProperty('password')) {
            url.password = components['password'];
        }

        if (components.hasOwnProperty('database')) {
            url.pathname = '/' + components['database'];
        }        

        if (components.hasOwnProperty('options')) {
            let options = components.options;

            _.forOwn(options, (value, key) => {
                url.searchParams.set(key, typeof value === 'boolean' ? (value ? 1 : 0) : value);
            });
        }

        return url.href;
    }

    /**
     * Database name.
     * @member {string}
     */
    get database() {
        if (!this._database) {
            this._database = (new URL(this.connectionString)).pathname.substr(1);
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
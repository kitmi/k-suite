"use strict";

const { URL } = require('url');

/**
 * A database service object
 * @class
 */
class DbService {
    /**
     * @param {RoutableApp} app - The app which creates this service
     * @param {string} type - Dbms type
     * @param {string} name - The name of database (the one appears as the key of db config)
     * @param {object} [options] - Options loaded from feature config
     * @property {object} [options.spec] - Dbms specifications
     * @property {string} [options.connection] - The connection string
     */
    constructor(app, type, name, options) {
        this.appModule = app;
        this.dbType = type;
        this.dbmsSpec = options.spec;
        this.name = name;
        this.serviceId = type + ':' + name;
        this.connectionString = options.connection;

        this.connectionComponents = new URL(this.connectionString);
        this.physicalDbName = this.connectionComponents.pathname.substr(1);
        this.physicalDbType = this.connectionComponents.protocol.split(':', 2)[0];
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
}

module.exports = DbService;

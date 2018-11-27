"use strict";

/**
 * Enable mongodb access as a service
 * @module Feature_MongoDB
 */

const _ = require('rk-utils')._;
const MongoClient = require('mongodb').MongoClient;
const Feature = require('../enum/Feature');
const DbService = require('../DbService');

/**
 * MongoDB Service.
 * @class
 */
class MongoDBService extends DbService {
    /**     
     * @param {CliApp} app 
     * @param {string} name 
     * @param {object} options 
     */
    constructor(app, name, options) {
        super(app, 'mongodb', name, options);
    }

    /**
     * Get a database connection.    
     * @param {Object} [options] - Extra options for the connection, optional
     * @returns {Promise.<MongoDBConnection>}
     */
    async getConnection_(options) {
        return MongoClient.connect(this.connectionString, Object.assign({ useNewUrlParser: true }, options));
    }

    /**
     * Close a database connection.     
     * @param {MongoDBConnection} conn
     */
    closeConnection(conn) {
        return conn.close();
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
    load_: async function (app, dbs) {
        _.forOwn(dbs, (opt, db) => {
            if (!opt.connection) {
                throw new Error(`Missing connection string for MongoDB "${db}".`);
            }       

            let service = new MongoDBService(app, db, opt);
            app.registerService(service.serviceId, service);
        });
    }
};
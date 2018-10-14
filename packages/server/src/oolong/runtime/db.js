"use strict";

const Mowa = require('../../server.js');

class Db {
    /**
     * Database object
     *
     * @constructs Db
     * @param {AppModule} appModule
     * @param {string} dbServiceId
     * @param {*} ctx
     */
    constructor(appModule, dbServiceId, ctx) {
        /**
         * Owner app module
         *
         * @type {AppModule}
         * @protected
         **/
        this.appModule = appModule;

        let [ dbType, dbName ] = dbServiceId.split(':');

        /**
         * Db name
         *
         * @public
         */
        this.name = dbName;

        /**
         * Db type
         *
         * @public
         */
        this.dbType = dbType;

        /**
         * Service id
         * 
         * @public
         */
        this.serviceId = dbServiceId;
        
        if (ctx) {
            //auto destruct if ctx given            
            assert: appModule.hasPostActions, 'postActions middleware is required for using db model in http request';
            
            /**
             * Request context
             *
             * @public
             */
            this.ctx = ctx;    
        }        
    }

    /**
     * Get the database service object
     * @returns {*|Object}
     */
    get service() {
        return this.appModule.getService(this.serviceId);
    }

    /**
     * Get the database connection     
     * @returns {*|Promise.<Object>}
     */
    async conn_() {
        if (!this._conn) {
            this._conn = await this.service.getConnection_();
            if (this.ctx) {
                this._autoRelease = () => {
                    this.release();
                }

                this.ctx.addPostAction(this._autoRelease);
            }
        }

        return this._conn;
    }    

    /**
     * Execute a query towards the database
     * @returns {*|Promise.<Object>}
     */
    async query_() {
        throw new Error('To be overrided by subclass.');
    }

    /**
     * Release the database connection
     * @returns {Db}
     */
    release() {
        if (this._conn) {
            if (this.ctx) {
                this.ctx.removePostAction(this._autoRelease);
                delete this._autoRelease;
            }

            this.service.closeConnection(this._conn);
            delete this._conn;
        }

        return this;
    }    

    async doTransaction_(businessLogic_) {
        let conn = await this.conn_();
        let result;

        try {
            await this.service.startTransaction_(conn);            

            try {            
                result = await businessLogic_(conn);
                console.log(result);
                result = await this.service.commitTransaction_(conn);
                console.log(result);
            } catch (error) {
                await this.service.rollbackTransaction_(conn);
            }     
        } finally {
            if (!this.ctx) {
                this.release();
            }
        }        

        return result;
    }
}

module.exports = Db;
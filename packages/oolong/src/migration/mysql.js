"use strict";

const path = require('path');
const { _, fs, eachAsync_ } = require('rk-utils');

/**
 * MySQL migration.
 * @class
 */
class MySQLMigration {
    /**     
     * @param {object} context
     * @param {Connector} connector
     */
    constructor(context, connector) {
        this.logger = context.logger;
        this.scriptSourcePath = context.scriptSourcePath;
        this.connector = connector;
    }

    async reset_() {
        return this.connector.execute_(`DROP DATABASE IF EXISTS ??`, [ this.connector.database ]);
    }

    async create_() {
        let dbScriptDir = path.join(this.scriptSourcePath, this.connector.driver, this.connector.database);
        
        let sqlFiles = [ 'entities.sql', 'relations.sql', 'procedures.sql' ];
        
        let result = await this.connector.execute_('CREATE DATABASE IF NOT EXISTS ??', 
            [ this.connector.database ], 
            { createDatabase: true }
        );
        
        if (result.warningStatus == 0) {
            this.logger.log('info', `Created database "${this.connector.database}".`);
        } else {
            this.logger.log('warn', `Database "${this.connector.database}" exists.`);
        }                        

        await this.connector.execute_('USE ??', [ this.connector.database ]);

        return eachAsync_(sqlFiles, async (file) => {
            let sqlFile = path.join(dbScriptDir, file);
            if (!fs.existsSync(sqlFile)) {
                throw new Error(`Database script "${file}" not found. Try run "oolong build" first.`);
            }

            let sql = _.trim(fs.readFileSync(sqlFile, { encoding: 'utf8' }));
            if (sql) {
                result = _.castArray(await this.connector.execute_(sql));

                let warningRows = _.reduce(result, (sum, row) => {
                    sum += row.warningStatus;
                    return sum;
                }, 0);

                if (warningRows > 0) {
                    this.logger.log('warn', `${warningRows} warning(s) reported while running "${file}".`);
                } else {
                    this.logger.log('info', `Database scripts for "${this.connector.database}" run successfully.`);
                }
            }
        });
    }

    async loadData(dataFile) {
        let ext = path.extname(dataFile);
        let content = fs.readFileSync(dataFile, {encoding: 'utf8'});

        let db = this.appModule.db(this.dbService.serviceId);

        if (ext === '.json') {
            let data = JSON.parse(content);

            try {
                await Util.eachAsync_(data, async (records, entityName) => {
                    let Model = db.model(entityName);                        
                    let items = Array.isArray(records) ? records : [ records ];
    
                    return Util.eachAsync_(items, async item => {
                        try {
                            let model = new Model(item);
                            let result = await model.save_();
                            if (!result || !result.data) {
                                throw new Error(`Unknown error occurred during saving a new "${entityName}" entity.`);
                            }

                            this.logger.log('verbose', `Added a new "${entityName}" entity.`, result.data);
                        } catch (error) {
                            if (error.errors && error.errors.length === 1 && error.errors[0].code === 'ER_DUP_ENTRY') {
                                this.logger.log('warn', error.message);       
                            } else {
                                throw error;
                            }                            
                        }
                    });
                });
            } finally {
                db.release();
            }
        } else if (ext === '.sql') {
            try {                
                let [ result ] = await db.query_(content);
                this.logger.log('verbose', `Executed a new SQL file.`, result);
            } finally {
                db.release();
            }
        } else {
            throw new Error('Unsupported data file format.');
        }
    }
}

module.exports = MySQLMigration;
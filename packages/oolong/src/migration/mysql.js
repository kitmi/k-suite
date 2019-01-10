"use strict";

const path = require('path');
const { _, fs, eachAsync_, pascalCase } = require('rk-utils');

/**
 * MySQL migration.
 * @class
 */
class MySQLMigration {
    /**     
     * @param {object} context
     * @param {Connector} connector
     */
    constructor(context, schemaName, connector) {
        this.logger = context.logger;
        this.modelPath = context.modelPath;
        this.scriptSourcePath = context.scriptSourcePath;
        this.schemaName = schemaName;
        this.connector = connector;

        this.dbScriptPath = path.join(this.scriptSourcePath, this.connector.driver, this.connector.database);
    }

    async reset_() {
        return this.connector.execute_(`DROP DATABASE IF EXISTS ??`, [ this.connector.database ], { createDatabase: true });
    }

    async create_() {        
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

        return eachAsync_(sqlFiles, async (file) => {
            let sqlFile = path.join(this.dbScriptPath, file);
            if (!fs.existsSync(sqlFile)) {
                throw new Error(`Database script "${file}" not found. Try run "oolong build" first.`);
            }

            let sql = _.trim(fs.readFileSync(sqlFile, { encoding: 'utf8' }));
            if (sql) {
                result = _.castArray(await this.connector.execute_(sql, null, { multipleStatements: 1 }));

                let warningRows = _.reduce(result, (sum, row) => {
                    sum += row.warningStatus;
                    return sum;
                }, 0);

                if (warningRows > 0) {
                    this.logger.log('warn', `${warningRows} warning(s) reported while running "${file}".`);
                } else {
                    this.logger.log('info', `Database scripts "${sqlFile}" run successfully.`);
                }
            }
        });
    }

    async load_(dataFile) {
        let ext = path.extname(dataFile);

        if (ext === '.json') {
            let data = fs.readJsonSync(dataFile, {encoding: 'utf8'});

            let className = pascalCase(this.schemaName);
            let Db = require(path.join(this.modelPath, className));
            let db = new Db(this.connector.connectionString, this.connector.options);

            try {
                await eachAsync_(data, async (records, entityName) => {
                    let Model = db.model(entityName);                        
                    let items = Array.isArray(records) ? records : [ records ];

                    return eachAsync_(items, async item => {
                        let model = await Model.create_(item);
                        this.logger.log('verbose', `Created a(n) ${entityName} entity: ${JSON.stringify(model.$pkValues)}`);
                    });
                });
            } catch (error) {
                throw error;
            } finally {
                await db.close_();
            }
        } else if (ext === '.sql') {
            let sql = fs.readFileSync(dataFile, {encoding: 'utf8'});
            let result = await this.connector.execute_(sql, null, { multipleStatements: 1 });
            this.logger.log('verbose', `Executed SQL file: ${dataFile}`, result);
        } else {
            throw new Error('Unsupported data file format.');
        }
    }
}

module.exports = MySQLMigration;
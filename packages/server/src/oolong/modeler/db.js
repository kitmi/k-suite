"use strict";

const Util = require('../../util.js');
const fs = Util.fs;

class DbModeler {
    /**
     * Oolong database modeler
     * @constructs OolongDbModeler
     * @param {object} context
     * @property {Logger} context.logger - Logger object
     * @property {AppModule} context.currentApp - Current app module
     * @property {bool} context.verbose - Verbose mode
     * @property {OolongLinker} context.linker - Oolong DSL linker
     * @param {dbmsOptions} dbmsOptions
     */
    constructor(context, dbmsOptions) {
        this.logger = context.logger;
        this.linker = context.linker;
        this.dbmsOptions = dbmsOptions;
    }

    /**
     * Modeling the schemas inside the linker and returns a list of modeled schemas
     * @returns {Array}
     */
    modeling(dbService, schema, buildPath) {
        this.logger.log('info', 'Modeling database structure for schema "' + schema.name + '" ...');
    }

    async extract(dbService, extractedOolPath, removeTablePrefix) {
        this.logger.log('info', `Extracting database structure from "${dbService.serviceId}" ...`);
    }

    _writeFile(filePath, content) {
        fs.ensureFileSync(filePath);
        fs.writeFileSync(filePath, content);

        this.logger.log('info', 'Generated db script: ' + filePath);
    }
}

module.exports = DbModeler;
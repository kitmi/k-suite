"use strict";

const Util = require('../../util.js');
const _ = Util._;
const fs = Util.fs;

const path = require('path');
const escodegen = require('escodegen');
const Snippets = require('./dao/snippets.js');

class RestifyModeler {
    /**
     * Oolong database access object (DAO) modeler
     * @constructs OolongDaoModeler
     * @param {object} context
     * @property {Logger} context.logger - Logger object
     * @property {AppModule} context.currentApp - Current app module
     * @property {bool} context.verbose - Verbose mode
     * @property {OolongLinker} context.linker - Oolong DSL linker
     * @param {string} buildPath
     */
    constructor(context, buildPath) {
        this.logger = context.logger;
        this.linker = context.linker;
        this.verbose = context.verbose;
        this.buildPath = buildPath;
    }

    modeling(schema, dbService) {
        this.logger.log('info', 'Modeling restful endpoints for schema "' + schema.name + '"...');

        _.forOwn(schema.entities, (entity, entityName) => {
            let controllerFile = path.resolve(this.buildPath, entityName + '.js');
            RestifyModeler._exportSourceCode(Snippets.restMethods(dbService.serviceId, entityName, _.upperFirst(entityName)), controllerFile);

            this.logger.log('info', 'Generated restful controller: ' + controllerFile);
        });
    }

    static _exportSourceCode(ast, modelFilePath) {
        let content = escodegen.generate(ast, {
            format: {
                indent: {
                    style: '    ',
                    base: 0,
                    adjustMultilineComment: false
                },
                newline: '\n',
                space: ' ',
                json: false,
                renumber: false,
                hexadecimal: false,
                quotes: 'single',
                escapeless: false,
                compact: false,
                parentheses: true,
                semicolons: true,
                safeConcatenation: false
            },
            comment: true
        });

        fs.ensureFileSync(modelFilePath);
        fs.writeFileSync(modelFilePath, content);
    }
}

module.exports = RestifyModeler;
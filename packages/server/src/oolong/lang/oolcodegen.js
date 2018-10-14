"use strict";

const Util = require('../../util.js');
const _ = Util._;

const KW_NAMESPACE = 'use';
const KW_SCHEMA = 'schema';
const KW_ENTITIES = 'entities';
const KW_ENTITY_AS_ALIAS = 'as';
const KW_TYPE_DEFINE = 'type';
const KW_ENTITY = 'entity';
const KW_COMMENT = '--';
const KW_WITH_FEATURE = 'with';
const KW_FIELDS = 'has';
const KW_INDEXES = 'index';

const Oolong = require('./oolong.js');
const validator = require('validator');

class OolCodeGen {
    indented = 0;
    content = '';

    constructor(options) {
        this.options = options;
    }

    generate(json) {
        this.generateObject(json);

        return this.content;
    }

    appendLine(line) {
        if (line) {
            if (arguments.length > 1) {
                line = [ ...arguments].join(' ');
            }

            this.content += (this.indented > 0 ? _.repeat(' ', this.indented) : '') + line + '\n';
        } else {
            this.content += '\n';
        }
        return this;
    }

    indent() {
        this.indented += 2;
        return this;
    }

    dedent() {
        this.indented -= 2;
        return this;
        post: this.indented >= 0, 'Unexpected indented state.';
    }

    generateObject(obj) {
        _.forOwn(obj, (v,k) => {
            let generateMethod = 'generate_' + k;

            if (generateMethod in this) {
                return this[generateMethod](v);
            }

            throw new Error('to be implemented.');
        });
    }

    generate_namespace(namespaces) {
        pre: {
            Array.isArray(namespaces), 'Invalid namespaces.';
            this.indented == 0, 'Unexpected indented state.';
        }

        if (namespaces.length > 0) {
            this.appendLine(KW_NAMESPACE).indent();

            namespaces.forEach(ns => {
                this.appendLine(Util.quote(ns, "'"));
            });

            this.dedent();
        }

        post: this.indented == 0, 'Unexpected indented state.';
    }

    generate_schema(schema) {
        pre: {
            _.isPlainObject(schema), 'Invalid schema.';
            this.indented == 0, 'Unexpected indented state.';
        }

        this.appendLine(KW_SCHEMA, Util.quote(schema.name, "'")).indent();

        if (schema.entities) {
            this.appendLine(KW_ENTITIES).indent();

            schema.entities.forEach(entityEntry => {
                if (entityEntry.alias) {
                    this.appendLine(entityEntry.entity, KW_ENTITY_AS_ALIAS, entityEntry.alias);
                } else {
                    this.appendLine(entityEntry.entity);
                }
            });

            this.dedent().appendLine();
        }

        this.dedent();

        post: this.indented == 0, 'Unexpected indented state.';
    }

    generate_type(types) {
        pre: {
            _.isPlainObject(types), 'Invalid types.';
            this.indented == 0, 'Unexpected indented state.';
        }

        if (!_.isEmpty(types)) {
            this.appendLine(KW_TYPE_DEFINE).indent();

            _.forOwn(types, (type, name) => {
                if (type.type === 'enum') {
                    this.appendLine(name, ':', JSON.stringify(type.values));
                } else {
                    this.appendLine(name, ':', type.type);
                }
            });

            this.dedent();
        }

        post: this.indented == 0, 'Unexpected indented state.';
    }

    generate_field_comment(entityName, colName) {
        let colNameFullSnake = _.trimStart(_.snakeCase(colName), '_');
        let  [ colNameFirstWord, colNameRest ] = colNameFullSnake.split('_', 2);

        let result;

        let entityNameFullSnake = _.trim(_.snakeCase(entityName), '_');
        if (_.endsWith(entityNameFullSnake, colNameFirstWord)) {
            result = entityNameFullSnake + '_' + colNameRest;
        } else {
            result = entityNameFullSnake + '_' + colNameFullSnake;
        }

        return Util.normalizeDisplayName(result);
    }

    generate_entity(entities) {
        pre: {
            _.isPlainObject(entities), 'Invalid entities.';
            this.indented == 0, 'Unexpected indented state.';
        }

        _.forOwn(entities, (entity, enityName) => {
            this.appendLine(KW_ENTITY, enityName).indent();

            this.appendLine(KW_COMMENT, Util.quote(Util.normalizeDisplayName(enityName)));

            let hasAutoId = false;

            if (!_.isEmpty(entity.features)) {
                this.appendLine(KW_WITH_FEATURE).indent();

                entity.features.forEach(feature => {
                    if (feature.name === 'autoId') {
                        hasAutoId = true;
                    }

                    if (feature.options) {
                        this.appendLine(feature.name + '(' + JSON.stringify(feature.options) + ')');
                    } else {
                        this.appendLine(feature.name);
                    }
                });

                this.dedent();
            }

            if (!_.isEmpty(entity.fields)) {
                let typeDef;

                this.appendLine().appendLine(KW_FIELDS).indent();

                _.forOwn(entity.fields, (field, name) => {
                    let lineInfo = [];
                    lineInfo.push(Oolong.OOL_TYPE_KEYWORDS.has(name) ? Util.quote(name) : name);

                    if (field.type && field.type !== name) {
                        lineInfo.push(':');

                        switch (field.type) {
                            case 'int':
                                typeDef = 'int';

                                let hasBytes = false;
                                let needCloseBracket = false;
                                if (field.hasOwnProperty('bytes')) {

                                    if (field.bytes > 32) {
                                        throw new Error('Integer with more than 32 bytes is not supported.');
                                    }

                                    hasBytes = true;
                                    needCloseBracket = true;
                                    typeDef += '(' + field.bytes.toString() + 'B';
                                }

                                if (field.hasOwnProperty('digits')) {

                                    if (field.digits > 78) {
                                        throw new Error('Integer with more than 78 digits is not supported.');
                                    }

                                    needCloseBracket = true;

                                    if (hasBytes) {
                                        typeDef += ', ';
                                    } else {
                                        typeDef += '(';
                                    }

                                    typeDef += field.digits.toString();
                                }

                                if (needCloseBracket) {
                                    typeDef += ')';
                                }
                                lineInfo.push(typeDef);

                                if (field.unsigned) {
                                    lineInfo.push('unsigned');
                                }

                                if ('default' in field) {
                                    field.default = validator.toInt(field.default);
                                }
                                break;

                            case 'float':                            
                            case 'decimal':
                                typeDef = 'number';
                                if (field.hasOwnProperty('totalDigits') || field.hasOwnProperty('decimalDigits')) {
                                    typeDef += '(';

                                    if (field.hasOwnProperty('totalDigits')) {
                                        typeDef += field.totalDigits.toString();
                                    }

                                    if (field.hasOwnProperty('decimalDigits')) {
                                        typeDef += ', ' + field.decimalDigits.toString();
                                    }

                                    typeDef += ')';
                                }
                                lineInfo.push(typeDef);

                                if (field.type === 'decimal') {
                                    lineInfo.push('exact');
                                }

                                if ('default' in field) {
                                    field.default = validator.toFloat(field.default);
                                }
                                break;

                            case 'text':
                            case 'binary':
                                if (field.fixedLength) {
                                    lineInfo.push(field.type + '(' + field.fixedLength + ')', 'fixedLength');
                                } else if (field.maxLength) {
                                    lineInfo.push(field.type + '(' + field.maxLength + ')');
                                } else {
                                    lineInfo.push(field.type);
                                }

                                break;

                            case 'datetime':
                                lineInfo.push(field.type);
                                break;
                            
                            case 'bool':
                                lineInfo.push(field.type);

                                if ('default' in field) {
                                    field.default = validator.toBoolean(field.default);
                                }
                                
                                break;

                            default:
                                lineInfo.push(field.type);
                        }
                    }

                    if (field.belongTo) {
                        lineInfo.push('->');
                        lineInfo.push(field.belongTo);
                    }

                    if (field.bindTo) {
                        lineInfo.push('<->');
                        lineInfo.push(field.bindTo);
                    }

                    if (field.readOnly) {
                        lineInfo.push('readOnly');
                    }

                    if (field.writeOnceOnly) {
                        lineInfo.push('writeOnceOnly');
                    }

                    if (field.fixedValue) {
                        lineInfo.push('fixed');
                    }

                    if (field.optional) {
                        lineInfo.push('optional');
                    }

                    if ('default' in field) {
                        lineInfo.push('default(' + JSON.stringify(field.default) + ')');
                    } else if (field.auto) {
                        lineInfo.push('default(auto)');
                    }

                    if (field.validators0) {
                        field.validators0.forEach(v => {
                            lineInfo.push('~' + this._translateFunctor(v));
                        });
                    }

                    if (field.modifiers0) {
                        field.modifiers0.forEach(v => {
                            lineInfo.push('|' + this._translateFunctor(v));
                        });
                    }

                    if (field.validators1) {
                        field.validators1.forEach(v => {
                            lineInfo.push('~' + this._translateFunctor(v));
                        });
                    }

                    if (field.modifiers1) {
                        field.modifiers1.forEach(v => {
                            lineInfo.push('|' + this._translateFunctor(v));
                        });
                    }

                    lineInfo.push('-- ' + Util.quote(this.generate_field_comment(enityName, name)));

                    this.appendLine(...lineInfo);
                });

                this.dedent();
            }

            if (entity.key && !hasAutoId) {
                this.appendLine().appendLine('key', entity.key).appendLine();
            }

            if (!_.isEmpty(entity.indexes)) {
                this.appendLine().appendLine(KW_INDEXES).indent();

                entity.indexes.forEach(i => {
                    let indexInfo = [];

                    if (Array.isArray(i.fields)) {
                        indexInfo.push('[' + i.fields.join(', ') + ']');
                    } else {
                        indexInfo.push(i.fields);
                    }

                    if (i.unique) {
                        indexInfo.push('is');
                        indexInfo.push('unique');
                    }

                    this.appendLine(...indexInfo);
                });

                this.dedent();
            }

            this.dedent();
        });

        post: this.indented == 0, 'Unexpected indented state.';
    }

    _translateFunctor(f) {
        let r = f.name;

        if (!_.isEmpty(f.args)) {
            r += '(';

            f.args.forEach((a, i) => {
                if (i > 0) {
                    r += ', '
                }

                if (_.isPlainObject(a)) {
                    if (a.oolType === 'ObjectReference') {
                        r += '@' + a.name;
                    } else {
                        throw new Error('to be implemented.');
                    }
                } else {
                    r += JSON.stringify(a);
                }
            });

            r += ')';
        }

        return r;
    }
}

exports.generate = function (json, options) {
    let codeGen = new OolCodeGen(options);
    return codeGen.generate(json);
};
"use strict";

const Util = require('rk-utils');
const { _ } = Util;
const { generateDisplayName } = require('./OolUtils');
const { isNothing } = require('../utils/lang');

const KW_NAMESPACE = 'use';
const KW_SCHEMA = 'schema';
const KW_ENTITIES = 'entities';
const KW_ENTITY_AS_ALIAS = 'as';
const KW_TYPE_DEFINE = 'type';
const KW_ENTITY = 'entity';
const KW_CODE = 'code';
const KW_COMMENT = '--';
const KW_WITH_FEATURE = 'with';
const KW_FIELDS = 'has';
const KW_ASSOCIATIONS = 'associations';
const KW_KEY = 'key';
const KW_INDEXES = 'index';

const Types = require('./types');
const OolTypes = require('./OolTypes');
const validator = require('validator');

class OolCodeGen {
    static transform(json, options) {
        let codeGen = new OolCodeGen(options);
        return codeGen.generate(json);
    }

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

            this.dedent().appendLine();
        }

        post: this.indented == 0, 'Unexpected indented state.';
    }

    generate_schema(schema) {
        pre: {            
            this.indented == 0, 'Unexpected indented state.';
        }

        _.forOwn(schema, (schemaInfo, name) => {
            this.appendLine(KW_SCHEMA, Util.quote(name, "'")).indent();

            if (schemaInfo.entities) {
                this.appendLine(KW_ENTITIES).indent();

                schemaInfo.entities.forEach(entityEntry => {
                    if (entityEntry.alias) {
                        this.appendLine(entityEntry.entity, KW_ENTITY_AS_ALIAS, entityEntry.alias);
                    } else {
                        this.appendLine(entityEntry.entity);
                    }
                });

                this.dedent().appendLine();
            }

            this.dedent();
        });        

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

        return generateDisplayName(result);
    }

    generate_entity(entities) {
        pre: {
            _.isPlainObject(entities), 'Invalid entities.';
            this.indented == 0, 'Unexpected indented state.';
        }

        _.forOwn(entities, (entity, enityName) => {
            this.appendLine(KW_ENTITY, enityName).indent();

            if (entity.source) {
                this.appendLine(KW_CODE, Util.quote(entity.source));
            }

            this.appendLine(KW_COMMENT, Util.quote(entity.comment || generateDisplayName(enityName)));

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
                this.appendLine().appendLine(KW_FIELDS).indent();

                _.forOwn(entity.fields, (field, name) => {
                    assert: field.type;

                    if (field.type === '$association') return;

                    let lineInfo = [];
                    lineInfo.push(Types.Builtin.has(name) ? Util.quote(name) : name);                    
                    
                    if (field.type !== name) {
                        lineInfo.push(':');
                        lineInfo.push(field.type);
                    }                  

                    let extraTypeInfo = _.omit(field, ['type', 'modifiers']);                    
                    
                    let typeMeta = Types[field.type];

                    _.forOwn(extraTypeInfo, (v, k) => {
                        if (!typeMeta.qualifiers.includes(k)) {
                            throw new Error(`"${k}" is not a valid qualifier for type "${field.type}".`);
                        }

                        if (typeof v === 'boolean' || isNothing(v)) {
                            if (v) {
                                lineInfo.push(k);
                            }
                        } else {
                            lineInfo.push(k + '(' + JSON.stringify(v) + ')');
                        }
                    });

                    if (field.modifiers) {
                        field.modifiers.forEach(v => {
                            switch (v.oolType) {
                                case OolTypes.Lang.VALIDATOR:
                                lineInfo.push('~' + this._translateFunctor(v));
                                break;

                                case OolTypes.Lang.PROCESSOR:
                                lineInfo.push('|>' + this._translateFunctor(v));
                                break;

                                case OolTypes.Lang.ACTIVATOR:
                                lineInfo.push('=' + this._translateFunctor(v));
                                break;

                                default:
                                    throw new Error(`Unknown modifier type: "${v.oolType}"!`);
                            }                                
                        });
                    } 

                    lineInfo.push(KW_COMMENT + ' ' + (field.comment || Util.quote(this.generate_field_comment(enityName, name))));

                    this.appendLine(...lineInfo);
                });

                this.dedent();
            }

            if (!_.isEmpty(entity.associations)) {
                this.appendLine().appendLine(KW_ASSOCIATIONS).indent();

                entity.associations.forEach(({ type, from, entity }) => {
                    if (from) {
                        this.appendLine(type, entity, 'as', from);
                    } else {
                        this.appendLine(type, entity);
                    }                    
                });

                this.dedent();
            }

            if (entity.key && !hasAutoId) {
                this.appendLine().appendLine(KW_KEY, entity.key);
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

module.exports = OolCodeGen;
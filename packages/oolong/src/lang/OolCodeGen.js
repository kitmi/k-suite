"use strict";

const Util = require('rk-utils');
const { _ } = Util;
const { generateDisplayName } = require('./OolUtils');
const { isNothing, isQuotedWith } = require('../utils/lang');

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

            throw new Error('to be implemented, object: ' + k);
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
                let lineInfo = [ name, ':', type.type ];

                this._translateType(type, lineInfo);

                this.appendLine(...lineInfo);
            });

            this.dedent().appendLine();
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
                    if (typeof feature === 'string') {
                        feature = { name: feature };
                    }

                    if (feature.name === 'autoId') {
                        hasAutoId = true;
                    }

                    if (feature.args) {
                        this.appendLine(feature.name + '(' + feature.args.map(a => JSON.stringify(a)).join(', ') + ')');
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

                    let lineInfo = [];
                    lineInfo.push(Types.Builtin.has(name) ? Util.quote(name) : name);                    
                    
                    if (field.type !== name) {
                        lineInfo.push(':');
                        lineInfo.push(field.type);
                    }                  

                    this._translateType(field, lineInfo);

                    lineInfo.push(KW_COMMENT + ' ' + (field.comment || Util.quote(this.generate_field_comment(enityName, name))));

                    this.appendLine(...lineInfo);
                });

                this.dedent();
            }

            if (!_.isEmpty(entity.associations)) {
                this.appendLine().appendLine(KW_ASSOCIATIONS).indent();

                entity.associations.forEach(({ type, from, entity, through }) => {
                    if (from) {
                        this.appendLine(type, Util.quote(entity, "'"), 'as', Util.quote(from, "'"));
                    } else if (through) {
                        this.appendLine(type, Util.quote(entity, "'"), 'through', Util.quote(through, "'"));
                    } else {
                        this.appendLine(type, Util.quote(entity, "'"));
                    }                    
                });

                this.dedent();
            }

            if (entity.key && !hasAutoId) {
                let key = (Array.isArray(entity.key) && entity.key.length === 1) ? entity.key[0] : entity.key;
                if (Array.isArray(key)) {
                    this.appendLine().appendLine(KW_KEY, '[ ' + key.join(', ') + ' ]');
                } else {
                    this.appendLine().appendLine(KW_KEY, key);
                }                
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

    _translateType(field, lineInfo) {
        let extraTypeInfo = _.omit(field, ['type', 'modifiers', 'name']);
        //let typeMeta = Types[field.type];
        _.forOwn(extraTypeInfo, (v, k) => {
            //if (!typeMeta.qualifiers.includes(k)) {
            //    throw new Error(`"${k}" is not a valid qualifier for type "${field.type}".`);
            //}
            if (typeof v === 'boolean' || isNothing(v)) {
                if (v) {
                    lineInfo.push(k);
                }
            } else {
                v = _.castArray(v);
                lineInfo.push(k + '(' + this._translateArgs(v) + ')');
            }
        });

        if (field.modifiers) {
            this._translatePipedValue(lineInfo, field);
        }        
    }

    _translatePipedValue(lineInfo, value) {        
        if (value.modifiers) {
            value.modifiers.forEach(v => {
                switch (v.oolType) {
                    case OolTypes.Lang.VALIDATOR:
                    lineInfo.push('~' + this._translateModifier(v));
                    break;

                    case OolTypes.Lang.PROCESSOR:
                    lineInfo.push('|>' + this._translateModifier(v));
                    break;

                    case OolTypes.Lang.ACTIVATOR:
                    lineInfo.push('=' + this._translateModifier(v));
                    break;

                    default:
                        throw new Error(`Unknown modifier type: "${v.oolType}"!`);
                }                                
            });
        } 
    }

    _translateModifier(f) {
        let r = f.name;

        if (!_.isEmpty(f.args)) {
            r += '(';

            r += this._translateArgs(f.args);

            r += ')';
        }

        return r;
    }

    _translateArgs(args) {
        return args.map(a => this._translateArg(a)).join(', ');
    }

    _translateArg(a) {
        if (_.isPlainObject(a) && a.hasOwnProperty('oolType')) {
            if (a.oolType === 'PipedValue') {
                let pipeline = [ this._translateArg(a.value) ];

                if (a.modifiers) {
                    this._translatePipedValue(pipeline, a);
                }

                return pipeline.join(' ');
            } else if (a.oolType === 'ObjectReference') {
                return '@' + a.name;
            } else {
                throw new Error('Not supported oolType: ' + a.oolType);
            }
        } 

        if (typeof a === 'string' && isQuotedWith(a, '/')) return a;
        
        return JSON.stringify(a);
    }
}

module.exports = OolCodeGen;
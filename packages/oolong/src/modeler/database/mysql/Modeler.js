"use strict";

const EventEmitter = require('events');
const pluralize = require('pluralize');
const path = require('path');
const ntol = require('number-to-letter');

const Util = require('rk-utils');
const { _, fs } = Util;

const OolUtils = require('../../../lang/OolUtils');
const OolongDbModeler = require('../../Modeler');
const Entity = require('../../../lang/Entity');

const Rules = require('./mysql/rules-reverse');

const UNSUPPORTED_DEFAULT_VALUE = new Set(['BLOB', 'TEXT', 'JSON', 'GEOMETRY']);

/*
const MYSQL_KEYWORDS = [
    'select',
    'from',
    'where',
    'limit',
    'order',
    'group',
    'distinct',
    'insert',
    'update',
    'in',
    'offset',
    'by',
    'asc',
    'desc',
    'delete',
    'begin',
    'end',
    'left',
    'right',
    'join',
    'on',
    'and',
    'or',
    'not',
    'returns',
    'return',
    'create',
    'alter'
];
*/

class MySQLModelerler extends OolongDbModeler {
    /**
     * Ooolong database modeler for mysql db
     * @constructs OolongMysqlModeler
     * @extends OolongDbModeler
     * @param {object} context
     * @property {Logger} context.logger - Logger object
     * @property {AppModule} context.currentApp - Current app module
     * @property {bool} context.verbose - Verbose mode
     * @property {OolongLinker} context.linker - Oolong DSL linker
     * @param {object} dbmsOptions
     * @property {object} dbmsOptions.dbOptions
     * @property {object} dbmsOptions.tableOptions
     */
    constructor(context, dbmsOptions) {
        super(context);

        this._events = new EventEmitter();

        this._dbmsOptions = {
            dbOptions: _.reduce(dbmsOptions.dbOptions,
                function(result, value, key) {
                    result[_.upperCase(key)] = value;
                    return result;
                }, {}),
            tableOptions: _.reduce(dbmsOptions.tableOptions,
                function(result, value, key) {
                    result[_.upperCase(key)] = value;
                    return result;
                }, {})
        };

        this._references = {};
    }

    modeling(dbService, schema, buildPath) {
        super.modeling(dbService, schema, buildPath);

        let modelingSchema = schema.clone();

        if (modelingSchema.relations) {
            this.logger.log('debug', 'Building relations...');

            _.each(modelingSchema.relations, (relation) => {
                this._buildRelation(modelingSchema, relation);
            });
        }        

        this._events.emit('afterRelationshipBuilding');        

        //build SQL scripts
        let sqlFilesDir = path.join('mysql', dbService.name);
        let dbFilePath = path.join(sqlFilesDir, 'entities.sql');
        let fkFilePath = path.join(sqlFilesDir, 'relations.sql');
        let initIdxFilePath = path.join(sqlFilesDir, 'data', '_init', 'index.list');
        let initFilePath = path.join(sqlFilesDir, 'data', '_init', '0-init.json');
        let tableSQL = '', relationSQL = '', data = {};

        _.each(modelingSchema.entities, (entity, entityName) => {
            entity.addIndexes();

            let result = MySQLModeler.complianceCheck(entity);
            if (result.errors.length) {
                let message = '';
                if (result.warnings.length > 0) {
                    message += 'Warnings: \n' + result.warnings.join('\n') + '\n';
                }
                message += result.errors.join('\n');

                throw new Error(message);
            }

            if (entity.features) {
                _.forOwn(entity.features, (f, featureName) => {
                    if (Array.isArray(f)) {
                        f.forEach(ff => this._featureReducer(entity, featureName, ff));
                    } else {
                        this._featureReducer(entity, featureName, f);
                    }
                });
            }            

            tableSQL += this._createTableStatement(entityName, entity) + '\n';

            if (entity.info.data) {
                //intiSQL += `-- Initial data for entity: ${entityName}\n`;
                let entityData = [];

                if (Array.isArray(entity.info.data)) {
                    entity.info.data.forEach(record => {
                        if (!_.isPlainObject(record)) {
                            let fields = Object.keys(entity.fields);
                            if (fields.length !== 2) {
                                throw new Error(`Invalid data syntax: entity "${entity.name}" has more than 2 fields.`);
                            }

                            record = {[fields[1]]: record};
                        }

                        entityData.push(record);
                    });
                } else {
                    _.forOwn(entity.info.data, (record, key) => {
                        if (!_.isPlainObject(record)) {
                            let fields = Object.keys(entity.fields);
                            if (fields.length !== 2) {
                                throw new Error(`Invalid data syntax: entity "${entity.name}" has more than 2 fields.`);
                            }

                            record = {[entity.key]: key, [fields[1]]: record};
                        } else {
                            record = Object.assign({[entity.key]: key}, record);
                        }

                        entityData.push(record);
                        //intiSQL += 'INSERT INTO `' + entityName + '` SET ' + _.map(record, (v,k) => '`' + k + '` = ' + JSON.stringify(v)).join(', ') + ';\n';
                    });
                }

                if (!_.isEmpty(entityData)) {
                    data[entityName] = entityData;
                }

                //intiSQL += '\n';
            }
        });

        _.forOwn(this._references, (refs, srcEntityName) => {
            _.each(refs, ref => {
                relationSQL += MySQLModeler.addForeignKeyStatement(srcEntityName, schema.entities[srcEntityName], ref) + '\n';
            });
        });

        this._writeFile(path.join(buildPath, dbFilePath), tableSQL);
        this._writeFile(path.join(buildPath, fkFilePath), relationSQL);

        if (!_.isEmpty(data)) {
            this._writeFile(path.join(buildPath, initFilePath), JSON.stringify(data, null, 4));

            if (!fs.existsSync(path.join(buildPath, initIdxFilePath))) {
                this._writeFile(path.join(buildPath, initIdxFilePath), '0-init.json\n');
            }
        }

        let funcSQL = '';
        
        //process view
        _.each(modelingSchema.views, (view, viewName) => {
            view.inferTypeInfo(modelingSchema);

            funcSQL += `CREATE PROCEDURE ${dbService.getViewSPName(viewName)}(`;
            
            if (!_.isEmpty(view.params)) {
                let paramSQLs = [];
                view.params.forEach(param => {
                    paramSQLs.push(`p${_.upperFirst(param.name)} ${MySQLModeler.columnDefinition(param, true)}`);
                });

                funcSQL += paramSQLs.join(', ');
            }

            funcSQL += `)\nCOMMENT 'SP for view ${viewName}'\nREADS SQL DATA\nBEGIN\n`;

            funcSQL += this._viewDocumentToSQL(modelingSchema, view) + ';';

            funcSQL += '\nEND;\n\n';
        });

        let spFilePath = path.join(sqlFilesDir, 'procedures.sql');
        this._writeFile(path.join(buildPath, spFilePath), funcSQL);

        return modelingSchema;
    }

    

    _addReference(left, leftField, right, rightField) {
        let refs4LeftEntity = this._references[left];
        if (!refs4LeftEntity) {
            refs4LeftEntity = [];
            this._references[left] = refs4LeftEntity;
        }

        let found = _.find(refs4LeftEntity,
            item => (item.leftField === leftField && item.right === right && item.rightField === rightField)
        );

        if (found) {
            throw new Error(`The same reference already exist! From [${left}.${leftField}] to [${right}.${rightField}].`);
        }

        refs4LeftEntity.push({leftField, right, rightField});

        return this;
    }

    _getReferenceOfField(left, leftField) {
        let refs4LeftEntity = this._references[left];
        if (!refs4LeftEntity) {
            return undefined;
        }

        let reference = _.find(refs4LeftEntity,
            item => (item.leftField === leftField)
        );

        if (!reference) {
            return undefined;
        }

        return reference;
    }

    _hasReferenceOfField(left, leftField) {
        let refs4LeftEntity = this._references[left];
        if (!refs4LeftEntity) return false;

        return (undefined !== _.find(refs4LeftEntity,
            item => (item.leftField === leftField)
        ));
    }

    _getReferenceBetween(left, right) {
        let refs4LeftEntity = this._references[left];
        if (!refs4LeftEntity) {
            return undefined;
        }

        let reference = _.find(refs4LeftEntity,
            item => (item.right === right)
        );

        if (!reference) {
            return undefined;
        }

        return reference;
    }

    _hasReferenceBetween(left, right) {
        let refs4LeftEntity = this._references[left];
        if (!refs4LeftEntity) return false;

        return (undefined !== _.find(refs4LeftEntity,
            item => (item.right === right)
        ));
    }

    _featureReducer(entity, featureName, feature) {
        let field;

        switch (featureName) {
            case 'autoId':
                field = entity.fields[feature.field];

                if (field.type === 'int' && !field.generator) {
                    field.autoIncrementId = true;
                    if ('startFrom' in field) {
                        this._events.on('setTableOptions:' + entity.name, extraOpts => {
                            extraOpts['AUTO_INCREMENT'] = field.startFrom;
                        });
                    }
                } 
                break;

            case 'createTimestamp':
                field = entity.fields[feature.field];
                field.isCreateTimestamp = true;
                break;

            case 'updateTimestamp':
                field = entity.fields[feature.field];
                field.isUpdateTimestamp = true;
                break;

            case 'logicalDeletion':
                break;

            case 'atLeastOneNotNull':
                break;

            case 'validateAllFieldsOnCreation':
                break;
            
            case 'stateTracking':
                break;

            case 'i18n':
                break;

            default:
                throw new Error('Unsupported feature "' + featureName + '".');
        }
    }

    _buildRelation(schema, relation) {
        this.logger.log('debug', 'Analyzing relation between ['
        + relation.left + '] and ['
        + relation.right + '] relationship: '
        + relation.relationship + ' ...');

        if (relation.relationship === 'n:n') {
            this._buildNToNRelation(schema, relation);
        } else if (relation.relationship === '1:n') {
            this._buildOneToAnyRelation(schema, relation, false);
        } else if (relation.relationship === '1:1') {
            this._buildOneToAnyRelation(schema, relation, true);
        } else if (relation.relationship === 'n:1') {
            this._buildManyToOneRelation(schema, relation);
        } else {
            console.log(relation);
            throw new Error('TBD');
        }
    }

    _buildManyToOneRelation(schema, relation) {
        let leftEntity = schema.entities[relation.left];
        let rightEntity = schema.entities[relation.right];

        let rightKeyInfo = rightEntity.getKeyField();
        let leftField = relation.leftField || MySQLModeler.foreignKeyFieldNaming(relation.right, rightEntity);

        let fieldInfo = this._refineLeftField(rightKeyInfo);
        if (relation.optional) {
            fieldInfo.optional = true;
        }
        leftEntity.addField(leftField, fieldInfo);

        this._addReference(relation.left, leftField, relation.right, rightEntity.key);
    }

    _buildOneToAnyRelation(schema, relation, unique) {
        let leftEntity = schema.entities[relation.left];
        let rightEntity = schema.entities[relation.right];

        let rightKeyInfo = rightEntity.getKeyField();
        let leftField = relation.leftField || MySQLModeler.foreignKeyFieldNaming(relation.right, rightEntity);

        let fieldInfo = this._refineLeftField(rightKeyInfo);
        if (relation.optional) {
            fieldInfo.optional = true;
        }
        leftEntity.addField(leftField, fieldInfo);

        this._addReference(relation.left, leftField, relation.right, rightEntity.key);

        if (relation.multi && _.last(relation.multi) === relation.right) {
            
            this._events.on('afterRelationshipBuilding', () => {
                let index = {
                    fields: _.map(relation.multi, to => MySQLModeler.foreignKeyFieldNaming(to, schema.entities[to])),
                    unique: unique
                };

                leftEntity.addIndex(index);
            });
        }
    }

    _buildNToNRelation(schema, relation) {
        let relationEntityName = relation.left + Util.pascalCase(pluralize.plural(relation.right));

        if (schema.hasEntity(relationEntityName)) {
            let fullName = schema.entities[relationEntityName].id;

            throw new Error(`Entity [${relationEntityName}] conflicts with entity [${fullName}] in schema [${schema.name}].`);
        }

        this.logger.log('debug', `Create a relation entity for "${relation.left}" and "${relation.right}".`);
        
        let leftEntity = schema.entities[relation.left];
        let rightEntity = schema.entities[relation.right];
        
        let leftKeyInfo = leftEntity.getKeyField();
        let rightKeyInfo = rightEntity.getKeyField();
        
        if (Array.isArray(leftKeyInfo) || Array.isArray(rightKeyInfo)) {
            throw new Error('Multi-fields key not supported for non-relationship entity.');
        }

        let leftField1 = MySQLModeler.foreignKeyFieldNaming(relation.left, leftEntity);
        let leftField2 = MySQLModeler.foreignKeyFieldNaming(relation.right, rightEntity);
        
        let entityInfo = {
            features: [ 'createTimestamp' ],
            fields: {
                [leftField1]: leftKeyInfo,
                [leftField2]: rightKeyInfo
            },
            key: [ leftField1, leftField2 ]
        };

        let entity = new Entity(this.linker, relationEntityName, schema.oolModule, entityInfo);
        entity.link();
        entity.markAsRelationshipEntity();

        this._addReference(relationEntityName, leftField1, relation.left, leftEntity.key);
        this._addReference(relationEntityName, leftField2, relation.right, rightEntity.key);

        schema.addEntity(relationEntityName, entity);
    }

    _refineLeftField(fieldInfo) {
        return Object.assign(_.pick(fieldInfo, Oolong.BUILTIN_TYPE_ATTR), { isReference: true });
    }
    
    static oolOpToSql(op) {
        switch (op) {
            case '=':
                return '=';
            
            default:
                throw new Error('oolOpToSql to be implemented.');                
        }
    }
    
    static oolToSql(schema, doc, ool, params) {
        if (!ool.oolType) {
            return ool;
        }

        switch (ool.oolType) {
            case 'BinaryExpression':
                let left, right;
                
                if (ool.left.oolType) {
                    left = MySQLModeler.oolToSql(schema, doc, ool.left, params);
                } else {
                    left = ool.left;
                }

                if (ool.right.oolType) {
                    right = MySQLModeler.oolToSql(schema, doc, ool.right, params);
                } else {
                    right = ool.right;
                }
                
                return left + ' ' + MySQLModeler.oolOpToSql(ool.operator) + ' ' + right;
            
            case 'ObjectReference':
                if (!OolUtils.isMemberAccess(ool.name)) {
                    if (params && _.find(params, p => p.name === ool.name) !== -1) {
                        return 'p' + _.upperFirst(ool.name);
                    }
                    
                    throw new Error(`Referencing to a non-existing param "${ool.name}".`);
                }                
                
                let { entityNode, entity, field } = OolUtils.parseReferenceInDocument(schema, doc, ool.name);

                return entityNode.alias + '.' + MySQLModeler.quoteIdentifier(field.name);
            
            default:
                throw new Error('oolToSql to be implemented.'); 
        }
    }

    static _orderByToSql(schema, doc, ool) {
        return MySQLModeler.oolToSql(schema, doc, { oolType: 'ObjectReference', name: ool.field }) + (ool.ascend ? '' : ' DESC');
    }

    _viewDocumentToSQL(modelingSchema, view) {
        let sql = '  ';
        //console.log('view: ' + view.name);
        let doc = _.cloneDeep(view.getDocumentHierarchy(modelingSchema));
        //console.dir(doc, {depth: 8, colors: true});

        //let aliasMapping = {};
        let [ colList, alias, joins ] = this._buildViewSelect(modelingSchema, doc, 0);
        
        sql += 'SELECT ' + colList.join(', ') + ' FROM ' + MySQLModeler.quoteIdentifier(doc.entity) + ' AS ' + alias;

        if (!_.isEmpty(joins)) {
            sql += ' ' + joins.join(' ');
        }
        
        if (!_.isEmpty(view.selectBy)) {
            sql += ' WHERE ' + view.selectBy.map(select => MySQLModeler.oolToSql(modelingSchema, doc, select, view.params)).join(' AND ');
        }
        
        if (!_.isEmpty(view.groupBy)) {
            sql += ' GROUP BY ' + view.groupBy.map(col => MySQLModeler._orderByToSql(modelingSchema, doc, col)).join(', ');
        }

        if (!_.isEmpty(view.orderBy)) {
            sql += ' ORDER BY ' + view.orderBy.map(col => MySQLModeler._orderByToSql(modelingSchema, doc, col)).join(', ');
        }

        let skip = view.skip || 0;
        if (view.limit) {
            sql += ' LIMIT ' + MySQLModeler.oolToSql(modelingSchema, doc, skip, view.params) + ', ' + MySQLModeler.oolToSql(modelingSchema, doc, view.limit, view.params);
        } else if (view.skip) {
            sql += ' OFFSET ' + MySQLModeler.oolToSql(modelingSchema, doc, view.skip, view.params);
        }

        return sql;
    }

    _buildViewSelect(schema, doc, startIndex) {
        let entity = schema.entities[doc.entity];
        let alias = ntol(startIndex++);
        doc.alias = alias;

        let colList = Object.keys(entity.fields).map(k => alias + '.' + MySQLModeler.quoteIdentifier(k));
        let joins = [];

        if (!_.isEmpty(doc.subDocuments)) {
            _.forOwn(doc.subDocuments, (doc, fieldName) => {
                let [ subColList, subAlias, subJoins, startIndex2 ] = this._buildViewSelect(schema, doc, startIndex);
                startIndex = startIndex2;
                colList = colList.concat(subColList);
                
                joins.push('LEFT JOIN ' + MySQLModeler.quoteIdentifier(doc.entity) + ' AS ' + subAlias
                    + ' ON ' + alias + '.' + MySQLModeler.quoteIdentifier(fieldName) + ' = ' +
                    subAlias + '.' + MySQLModeler.quoteIdentifier(doc.linkWithField));

                if (!_.isEmpty(subJoins)) {
                    joins = joins.concat(subJoins);
                }
            });
        }

        return [ colList, alias, joins, startIndex ];
    }

    _createTableStatement(entityName, entity) {
        let sql = 'CREATE TABLE IF NOT EXISTS `' + entityName + '` (\n';

        //column definitions
        _.each(entity.fields, (field, name) => {
            sql += '  ' + MySQLModeler.quoteIdentifier(name) + ' ' + MySQLModeler.columnDefinition(field) + ',\n';
        });

        //primary key
        sql += '  PRIMARY KEY (' + MySQLModeler.quoteListOrValue(entity.key) + '),\n';

        //other keys
        if (entity.indexes && entity.indexes.length > 0) {
            entity.indexes.forEach(index => {
                sql += '  ';
                if (index.unique) {
                    sql += 'UNIQUE ';
                }
                sql += 'KEY (' + MySQLModeler.quoteListOrValue(index.fields) + '),\n';
            });
        }

        let lines = [];
        this._events.emit('beforeEndColumnDefinition:' + entityName, lines);
        if (lines.length > 0) {
            sql += '  ' + lines.join(',\n  ');
        } else {
            sql = sql.substr(0, sql.length-2);
        }

        sql += '\n)';

        //table options
        let extraProps = {};
        this._events.emit('setTableOptions:' + entityName, extraProps);
        let props = Object.assign({}, this._dbmsOptions.tableOptions, extraProps);

        sql = _.reduce(props, function(result, value, key) {
            return result + ' ' + key + '=' + value;
        }, sql);

        sql += ';\n';

        return sql;
    }
    
    static addForeignKeyStatement(entityName, entity, relation) {
        let sql = 'ALTER TABLE `' + entityName +
            '` ADD FOREIGN KEY (`' + relation.leftField + '`) ' +
            'REFERENCES `' + relation.right + '` (`' + relation.rightField + '`) ';

        sql += '';

        if (entity.isRelationshipEntity) {
            sql += 'ON DELETE CASCADE ON UPDATE CASCADE';
        } else {
            sql += 'ON DELETE NO ACTION ON UPDATE NO ACTION';
        }

        sql += ';\n';

        return sql;
    }

    static foreignKeyFieldNaming(entityName, entity) {
        let leftPart = Util._.camelCase(entityName);
        let rightPart = Util.pascalCase(entity.key);

        if (_.endsWith(leftPart, rightPart)) {
            return leftPart;
        }

        return leftPart + rightPart;
    }

    static quoteString(str) {
        return "'" + str.replace(/'/g, "\\'") + "'";
    }

    static quoteIdentifier(str) {
        return "`" + str + "`";
    }

    static quoteListOrValue(obj) {
        return _.isArray(obj) ?
            obj.map(v => MySQLModeler.quoteIdentifier(v)).join(', ') :
            MySQLModeler.quoteIdentifier(obj);
    }

    static complianceCheck(entity) {
        let result = { errors: [], warnings: [] };

        if (!entity.key) {
            result.errors.push('Primary key is not specified.');
        }

        return result;
    }

    static columnDefinition(field, isProc) {
        let col;
        
        switch (field.type) {
            case 'int':
            col = MySQLModeler.intColumnDefinition(field);
                break;

            case 'float':
            case 'decimal':
            col =  MySQLModeler.floatColumnDefinition(field);
                break;

            case 'text':
            col =  MySQLModeler.textColumnDefinition(field);
                break;

            case 'bool':
            col =  MySQLModeler.boolColumnDefinition(field);
                break;

            case 'binary':
            col =  MySQLModeler.binaryColumnDefinition(field);
                break;

            case 'datetime':
            col =  MySQLModeler.datetimeColumnDefinition(field);
                break;

            case 'json':
            col =  MySQLModeler.textColumnDefinition(field);
                break;

            case 'xml':
            col =  MySQLModeler.textColumnDefinition(field);
                break;

            case 'enum':
            col =  MySQLModeler.enumColumnDefinition(field);
                break;

            case 'csv':
            col =  MySQLModeler.textColumnDefinition(field);
                break;

            default:
                throw new Error('Unsupported type "' + field.type + '".');
        }

        let { sql, type } = col;        

        if (!isProc) {
            sql += this.columnNullable(field);
            sql += this.defaultValue(field, type);
        }

        return sql;
    }

    static intColumnDefinition(info) {
        let sql, type;

        if (info.digits) {
            if (info.digits > 10) {
                type = sql = 'BIGINT';
            } else if (info.digits > 7) {
                type = sql = 'INT';
            } else if (info.digits > 4) {
                type = sql = 'MEDIUMINT';
            } else if (info.digits > 2) {
                type = sql = 'SMALLINT';
            } else {
                type = sql = 'TINYINT';
            }

            sql += `(${info.digits})`
        } else {
            type = sql = 'INT';
        }

        if (info.unsigned) {
            sql += ' UNSIGNED';
        }

        return { sql, type };
    }

    static floatColumnDefinition(info) {
        let sql = '', type;

        if (info.type == 'decimal') {
            type = sql = 'DECIMAL';

            if (info.totalDigits > 65) {
                throw new Error('Total digits exceed maximum limit.');
            }
        } else {
            if (info.totalDigits > 23) {
                type = sql = 'DOUBLE';

                if (info.totalDigits > 53) {
                    throw new Error('Total digits exceed maximum limit.');
                }
            } else {
                type = sql = 'FLOAT';
            }
        }

        if ('totalDigits' in info) {
            sql += '(' + info.totalDigits;
            if ('decimalDigits' in info) {
                sql += ', ' +info.decimalDigits;
            }
            sql += ')';

        } else {
            if ('decimalDigits' in info) {
                if (info.decimalDigits > 23) {
                    sql += '(53, ' +info.decimalDigits + ')';
                } else  {
                    sql += '(23, ' +info.decimalDigits + ')';
                }
            }
        }

        return { sql, type };
    }

    static textColumnDefinition(info) {
        let sql = '', type;

        if (info.fixedLength && info.fixedLength <= 255) {
            sql = 'CHAR(' + info.fixedLength + ')';
            type = 'CHAR';
        } else if (info.maxLength) {
            if (info.maxLength > 16777215) {
                type = sql = 'LONGTEXT';
            } else if (info.maxLength > 65535) {
                type = sql = 'MEDIUMTEXT';
            } else if (info.maxLength > 2000) {
                type = sql = 'TEXT';
            } else {
                type = sql = 'VARCHAR';
                if (info.fixedLength) {
                    sql += '(' + info.fixedLength + ')';
                } else {
                    sql += '(' + info.maxLength + ')';
                }
            }
        } else {
            type = sql = 'TEXT';
        }

        return { sql, type };
    }

    static binaryColumnDefinition(info) {
        let sql = '', type;

        if (info.fixedLength <= 255) {
            sql = 'BINARY(' + info.fixedLength + ')';
            type = 'BINARY';
        } else if (info.maxLength) {
            if (info.maxLength > 16777215) {
                type = sql = 'LONGBLOB';
            } else if (info.maxLength > 65535) {
                type = sql = 'MEDIUMBLOB';
            } else {
                type = sql = 'VARBINARY';
                if (info.fixedLength) {
                    sql += '(' + info.fixedLength + ')';
                } else {
                    sql += '(' + info.maxLength + ')';
                }
            }
        } else {
            type = sql = 'BLOB';
        }

        return { sql, type };
    }

    static boolColumnDefinition() {
        return { sql: 'TINYINT(1)', type: 'TINYINT' };
    }

    static datetimeColumnDefinition(info) {
        let sql;

        if (!info.range || info.range === 'datetime') {
            sql = 'DATETIME';
        } else if (info.range === 'date') {
            sql = 'DATE';
        } else if (info.range === 'time') {
            sql = 'TIME';
        } else if (info.range === 'year') {
            sql = 'YEAR';
        } else if (info.range === 'timestamp') {
            sql = 'TIMESTAMP';
        }

        return { sql, type: sql };
    }

    static enumColumnDefinition(info) {
        return { sql: 'ENUM(' + _.map(info.values, (v) => MySQLModeler.quoteString(v)).join(', ') + ')', type: 'ENUM' };
    }

    static columnNullable(info) {
        if (info.hasOwnProperty('optional') && info.optional) {
            return ' NULL';
        }

        return ' NOT NULL';
    }

    static defaultValue(info, type) {
        if (info.isCreateTimestamp) {
            info.defaultByDb = true;
            return ' DEFAULT CURRENT_TIMESTAMP';
        }

        if (info.autoIncrementId) {
            info.defaultByDb = true;
            return ' AUTO_INCREMENT';
        }        

        if (info.isUpdateTimestamp) {            
            info.updateByDb = true;
            return ' ON UPDATE CURRENT_TIMESTAMP';
        }

        let sql = '';

        if (!info.optional && !info.hasOwnProperty('default') && !info.hasOwnProperty('auto')) {
            if (UNSUPPORTED_DEFAULT_VALUE.has(type)) {
                return '';
            }

            if (info.type === 'bool' || info.type === 'int' || info.type === 'float' || info.type === 'decimal') {
                sql += ' DEFAULT 0';
            } else {
                sql += ' DEFAULT ""';
            } 

            info.defaultByDb = true;
        }

        /*
        if (info.hasOwnProperty('default') && typeof info.default !== 'object') {
            let defaultValue = info.default;
            delete info.default;
            info.defaultByDb = true;

            if (info.type === 'bool') {
                if (_.isString(defaultValue)) {
                    sql += ' DEFAULT ' + (S(defaultValue).toBoolean() ? '1' : '0');
                } else {
                    sql += ' DEFAULT ' + (defaultValue ? '1' : '0');
                }
            } else if (info.type === 'int') {
                if (_.isInteger(defaultValue)) {
                    sql += ' DEFAULT ' + defaultValue.toString();
                } else {
                    sql += ' DEFAULT ' + parseInt(defaultValue).toString();
                }
            } else if (info.type === 'text') {
                sql += ' DEFAULT ' + Util.quote(defaultValue);
            } else if (info.type === 'float') {
                if (_.isNumber(defaultValue)) {
                    sql += ' DEFAULT ' + defaultValue.toString();
                } else {
                    sql += ' DEFAULT ' + parseFloat(defaultValue).toString();
                }
            } else if (info.type === 'binary') {
                sql += ' DEFAULT ' + Util.bin2Hex(defaultValue);
            } else if (info.type === 'datetime') {
                if (_.isInteger(defaultValue)) {
                    sql += ' DEFAULT ' + defaultValue.toString();
                } else {
                    sql += ' DEFAULT ' + Util.quote(defaultValue);
                }
            } else if (info.type === 'json') {
                if (typeof defaultValue === 'string') {
                    sql += ' DEFAULT ' + Util.quote(defaultValue);
                } else {
                    sql += ' DEFAULT ' + Util.quote(JSON.stringify(defaultValue));
                }
            } else if (info.type === 'xml' || info.type === 'enum' || info.type === 'csv') {
                sql += ' DEFAULT ' + Util.quote(defaultValue);
            } else {
                throw new Error('Unexpected path');
            }
        }        
        */
        
        return sql;
    }

    static removeTableNamePrefix(entityName, removeTablePrefix) {
        if (removeTablePrefix) {
            entityName = _.trim(_.snakeCase(entityName));

            removeTablePrefix = _.trimEnd(_.snakeCase(removeTablePrefix), '_') + '_';

            if (_.startsWith(entityName, removeTablePrefix)) {
                entityName = entityName.substr(removeTablePrefix.length);
            }
        }

        return OolUtils.entityNaming(entityName);
    };
}

module.exports = MySQLModeler;
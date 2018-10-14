"use strict";

const EventEmitter = require('events');
const pluralize = require('pluralize');
const path = require('path');
const ntol = require('number-to-letter');

const Util = require('../../../util.js');
const _ = Util._;
const fs = Util.fs;

const Oolong = require('../../lang/oolong.js');
const OolUtil = require('../../lang/ool-utils.js');
const OolongDbModeler = require('../db.js');
const Entity = require('../../lang/entity.js');

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

class MysqlModeler extends OolongDbModeler {
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

            let result = MysqlModeler.complianceCheck(entity);
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
                relationSQL += MysqlModeler.addForeignKeyStatement(srcEntityName, schema.entities[srcEntityName], ref) + '\n';
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
                    paramSQLs.push(`p${_.upperFirst(param.name)} ${MysqlModeler.columnDefinition(param, true)}`);
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

    async extract(dbService, extractedOolPath, removeTablePrefix) {
        await super.extract(dbService, extractedOolPath);

        fs.ensureDirSync(extractedOolPath);

        let conn = await dbService.getConnection_();

        let [ tables ] = await conn.query("select * from information_schema.tables where table_schema = ?", [ dbService.physicalDbName ]);

        let entities = [];

        let oolcodegen = require('../../lang/oolcodegen');
        let entitiesOolPath = path.join(extractedOolPath, 'entities');
        fs.ensureDirSync(entitiesOolPath);

        await Util.eachAsync_(tables, async table => {
            let entityName = MysqlModeler.removeTableNamePrefix(table.TABLE_NAME, removeTablePrefix);

            entities.push({ entity: entityName });

            await this.extractTableDetails(entityName, dbService, conn, table, oolcodegen, entitiesOolPath, removeTablePrefix);
        });

        let json = {
            "namespace": [
                "entities/**"
            ],
            "schema": {
                "entities": entities,
                "name": dbService.physicalDbName
            }
        };

        let schemaContent = oolcodegen.generate(json);
        let schemaFile = path.join(extractedOolPath, dbService.physicalDbName + '.ool');
        fs.writeFileSync(schemaFile, schemaContent);
        this.logger.log('info', `Extracted schema entry file "${schemaFile}".`);

        dbService.closeConnection(conn);
    }

    async extractTableDetails(entityName, dbService, conn, table, oolcodegen, extractedOolPath, removeTablePrefix) {
        let [ columns ] = await conn.query("select * from information_schema.columns where table_schema = ? and table_name = ?",
            [dbService.physicalDbName, table.TABLE_NAME]);

        let features = [], fields = {}, indexes = [], types = {}, key;

        columns.forEach(col => {
            let colName = OolUtil.fieldNaming(col.COLUMN_NAME);

            if (col.EXTRA === 'auto_increment') {
                let featureInfo = {
                    "name": "autoId",
                    "options": {
                        "startFrom": table.AUTO_INCREMENT
                    }
                };

                if (colName !== 'id') {
                    featureInfo.options.name = colName;
                }

                features.push(featureInfo);
                return;
            }

            if (col.COLUMN_DEFAULT === 'CURRENT_TIMESTAMP') {
                let featureInfo = {
                    "name": "createTimestamp"
                };

                features.push(featureInfo);
                return;
            }

            if (col.EXTRA === 'on update CURRENT_TIMESTAMP') {
                let featureInfo = {
                    "name": "updateTimestamp"
                };

                features.push(featureInfo);
                return;
            }

            if (colName === 'isDeleted' && col.COLUMN_TYPE === 'tinyint(1)') {
                let featureInfo = {
                    "name": "logicalDeletion"
                };

                features.push(featureInfo);
                return;
            }

            let fieldInfo = this._mysqlTypeToOolType(table, col, types);
            if (col.IS_NULLABLE === 'YES') {
                fieldInfo.optional = true;
            }

            if (col.COLUMN_DEFAULT) {
                fieldInfo.default = col.COLUMN_DEFAULT;
            }

            fields[colName] = fieldInfo;
            
            if (col.COLUMN_KEY === 'UNI') {
                indexes.push({
                    fields: colName,
                    unique: true
                });
            }
        });

        let [ indexInfo ] = await conn.query("SHOW INDEXES FROM ??", [ table.TABLE_NAME ]);
        let fk = {};
        indexInfo.forEach(i => {
            if (i.Key_name === 'PRIMARY') {
                key = OolUtil.fieldNaming(i.Column_name)
            } else {
                let fkColName = OolUtil.fieldNaming(i.Column_name);
                fk[fkColName] = {
                    keyName: i.Key_name,
                    fieldName: fkColName,
                    unique: i.Non_unique === 0
                };
            }
        });

        let [ referencesInfo ] = await conn.query("SELECT * FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE `REFERENCED_TABLE_SCHEMA` = ? AND `TABLE_NAME` = ? AND `REFERENCED_TABLE_NAME` IS NOT NULL",
            [ dbService.physicalDbName, table.TABLE_NAME ]);

        let l = referencesInfo.length;
        for (let i = 0; i < l; i++) {
            let ref = referencesInfo[i];
            let [ [refTableKey] ] = await conn.query("SHOW INDEXES FROM ?? WHERE `Key_name` = 'PRIMARY'", [ ref.REFERENCED_TABLE_NAME ]);

            if (refTableKey.Column_name.toLowerCase() !== ref.REFERENCED_COLUMN_NAME.toLowerCase()) {                
                console.log('Main table: ', ref);
                console.log('Reference to:', refTableKey);
                throw new Error('Not reference to a primary key column. To be implemented.');
            }

            let fkColName = OolUtil.fieldNaming(ref.COLUMN_NAME);

            if (!fk[fkColName]) {
                console.log('Main table: ', ref);
                console.log(fk);
                console.log(fkColName);
            }

            if (fk[fkColName].unique) {
                fields[fkColName] = {
                    bindTo: MysqlModeler.removeTableNamePrefix(ref.REFERENCED_TABLE_NAME, removeTablePrefix)
                        + '.' + MysqlModeler.removeTableNamePrefix(ref.REFERENCED_TABLE_NAME, removeTablePrefix)
                }
            } else {
                fields[fkColName] = {
                    belongTo: MysqlModeler.removeTableNamePrefix(ref.REFERENCED_TABLE_NAME, removeTablePrefix)
                        + '.' + MysqlModeler.removeTableNamePrefix(ref.REFERENCED_TABLE_NAME, removeTablePrefix)
                }
            }
        }

        let entity = {
            type: types,
            entity: {
                [entityName]: {
                    features,
                    fields,
                    key,
                    indexes
                }
            }
        };

        let entityContent = oolcodegen.generate(entity);
        let entityFile = path.join(extractedOolPath, entityName + '.ool');
        fs.writeFileSync(entityFile, entityContent);
        this.logger.log('info', `Extracted entity definition file "${entityFile}".`);
    }

    _mysqlTypeToOolType(table, col, types) {
        let applicableRule = _.find(Rules.columnTypeConversions, rule => rule.test(table, col));
        if (applicableRule) {
            return applicableRule.apply(table, col);
        }
        
        let typeInfo = {};        

        switch (col.DATA_TYPE) {
            case 'varchar':
                typeInfo.type = 'text';
                if (col.CHARACTER_MAXIMUM_LENGTH) {
                    typeInfo.maxLength = col.CHARACTER_MAXIMUM_LENGTH;
                }
                break;

            case 'char':
                typeInfo.type = 'text';
                if (col.CHARACTER_MAXIMUM_LENGTH) {
                    typeInfo.fixedLength = col.CHARACTER_MAXIMUM_LENGTH;
                }
                break;

            case 'bigint':
                typeInfo.type = 'int';
                typeInfo.digits = col.NUMERIC_PRECISION || 18;
                typeInfo.bytes = 8;
                if (_.endsWith(col.COLUMN_TYPE, ' unsigned')) typeInfo.unsigned = true;
                break;

            case 'int':
                typeInfo.type = 'int';
                typeInfo.digits = col.NUMERIC_PRECISION || 10;
                typeInfo.bytes = 4;
                if (_.endsWith(col.COLUMN_TYPE, ' unsigned')) typeInfo.unsigned = true;
                break;

            case 'mediumint':
                typeInfo.type = 'int';
                typeInfo.digits = col.NUMERIC_PRECISION || 7;
                typeInfo.bytes = 3;
                if (_.endsWith(col.COLUMN_TYPE, ' unsigned')) typeInfo.unsigned = true;
                break;

            case 'smallint':
                typeInfo.type = 'int';
                typeInfo.digits = col.NUMERIC_PRECISION || 4;
                typeInfo.bytes = 2;
                if (_.endsWith(col.COLUMN_TYPE, ' unsigned')) typeInfo.unsigned = true;
                break;

            case 'tinyint':
                if (_.startsWith(col.COLUMN_TYPE, 'tinyint(1)')) {
                    typeInfo.type = 'bool';
                } else {
                    typeInfo.type = 'int';
                    typeInfo.digits = col.NUMERIC_PRECISION || 2;
                    typeInfo.bytes = 1;
                    if (_.endsWith(col.COLUMN_TYPE, ' unsigned')) typeInfo.unsigned = true;
                }
                break;

            case 'enum':
                let left = col.COLUMN_TYPE.indexOf('(');
                let right = col.COLUMN_TYPE.lastIndexOf(')');

                let typeName = table.TABLE_NAME + _.upperFirst(col.COLUMN_NAME);

                types[typeName] = {
                    type: 'enum',
                    values: col.COLUMN_TYPE.substring(left + 1, right).split(',').map(v => v.substr(1, v.length - 2))
                };

                typeInfo.type = typeName;

                break;

            case 'text':
                typeInfo.type = 'text';
                typeInfo.maxLength = col.CHARACTER_MAXIMUM_LENGTH;
                break;

            case 'datetime':
            case 'timestamp':
                typeInfo.type = 'datetime';
                break;

            case 'decimal':
                typeInfo.type = 'decimal';
                typeInfo.totalDigits = col.NUMERIC_PRECISION;
                typeInfo.decimalDigits = col.NUMERIC_SCALE;
                break;

            case 'float':
                typeInfo.type = 'float';
                typeInfo.totalDigits = col.NUMERIC_PRECISION;
                typeInfo.decimalDigits = col.NUMERIC_SCALE;
                break;

            default:
                console.log(col);
                throw new Error('To be implemented.');
        }

        return typeInfo;
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
        let leftField = relation.leftField || MysqlModeler.foreignKeyFieldNaming(relation.right, rightEntity);

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
        let leftField = relation.leftField || MysqlModeler.foreignKeyFieldNaming(relation.right, rightEntity);

        let fieldInfo = this._refineLeftField(rightKeyInfo);
        if (relation.optional) {
            fieldInfo.optional = true;
        }
        leftEntity.addField(leftField, fieldInfo);

        this._addReference(relation.left, leftField, relation.right, rightEntity.key);

        if (relation.multi && _.last(relation.multi) === relation.right) {
            
            this._events.on('afterRelationshipBuilding', () => {
                let index = {
                    fields: _.map(relation.multi, to => MysqlModeler.foreignKeyFieldNaming(to, schema.entities[to])),
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

        let leftField1 = MysqlModeler.foreignKeyFieldNaming(relation.left, leftEntity);
        let leftField2 = MysqlModeler.foreignKeyFieldNaming(relation.right, rightEntity);
        
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
                    left = MysqlModeler.oolToSql(schema, doc, ool.left, params);
                } else {
                    left = ool.left;
                }

                if (ool.right.oolType) {
                    right = MysqlModeler.oolToSql(schema, doc, ool.right, params);
                } else {
                    right = ool.right;
                }
                
                return left + ' ' + MysqlModeler.oolOpToSql(ool.operator) + ' ' + right;
            
            case 'ObjectReference':
                if (!OolUtil.isMemberAccess(ool.name)) {
                    if (params && _.find(params, p => p.name === ool.name) !== -1) {
                        return 'p' + _.upperFirst(ool.name);
                    }
                    
                    throw new Error(`Referencing to a non-existing param "${ool.name}".`);
                }                
                
                let { entityNode, entity, field } = OolUtil.parseReferenceInDocument(schema, doc, ool.name);

                return entityNode.alias + '.' + MysqlModeler.quoteIdentifier(field.name);
            
            default:
                throw new Error('oolToSql to be implemented.'); 
        }
    }

    static _orderByToSql(schema, doc, ool) {
        return MysqlModeler.oolToSql(schema, doc, { oolType: 'ObjectReference', name: ool.field }) + (ool.ascend ? '' : ' DESC');
    }

    _viewDocumentToSQL(modelingSchema, view) {
        let sql = '  ';
        //console.log('view: ' + view.name);
        let doc = _.cloneDeep(view.getDocumentHierarchy(modelingSchema));
        //console.dir(doc, {depth: 8, colors: true});

        //let aliasMapping = {};
        let [ colList, alias, joins ] = this._buildViewSelect(modelingSchema, doc, 0);
        
        sql += 'SELECT ' + colList.join(', ') + ' FROM ' + MysqlModeler.quoteIdentifier(doc.entity) + ' AS ' + alias;

        if (!_.isEmpty(joins)) {
            sql += ' ' + joins.join(' ');
        }
        
        if (!_.isEmpty(view.selectBy)) {
            sql += ' WHERE ' + view.selectBy.map(select => MysqlModeler.oolToSql(modelingSchema, doc, select, view.params)).join(' AND ');
        }
        
        if (!_.isEmpty(view.groupBy)) {
            sql += ' GROUP BY ' + view.groupBy.map(col => MysqlModeler._orderByToSql(modelingSchema, doc, col)).join(', ');
        }

        if (!_.isEmpty(view.orderBy)) {
            sql += ' ORDER BY ' + view.orderBy.map(col => MysqlModeler._orderByToSql(modelingSchema, doc, col)).join(', ');
        }

        let skip = view.skip || 0;
        if (view.limit) {
            sql += ' LIMIT ' + MysqlModeler.oolToSql(modelingSchema, doc, skip, view.params) + ', ' + MysqlModeler.oolToSql(modelingSchema, doc, view.limit, view.params);
        } else if (view.skip) {
            sql += ' OFFSET ' + MysqlModeler.oolToSql(modelingSchema, doc, view.skip, view.params);
        }

        return sql;
    }

    _buildViewSelect(schema, doc, startIndex) {
        let entity = schema.entities[doc.entity];
        let alias = ntol(startIndex++);
        doc.alias = alias;

        let colList = Object.keys(entity.fields).map(k => alias + '.' + MysqlModeler.quoteIdentifier(k));
        let joins = [];

        if (!_.isEmpty(doc.subDocuments)) {
            _.forOwn(doc.subDocuments, (doc, fieldName) => {
                let [ subColList, subAlias, subJoins, startIndex2 ] = this._buildViewSelect(schema, doc, startIndex);
                startIndex = startIndex2;
                colList = colList.concat(subColList);
                
                joins.push('LEFT JOIN ' + MysqlModeler.quoteIdentifier(doc.entity) + ' AS ' + subAlias
                    + ' ON ' + alias + '.' + MysqlModeler.quoteIdentifier(fieldName) + ' = ' +
                    subAlias + '.' + MysqlModeler.quoteIdentifier(doc.linkWithField));

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
            sql += '  ' + MysqlModeler.quoteIdentifier(name) + ' ' + MysqlModeler.columnDefinition(field) + ',\n';
        });

        //primary key
        sql += '  PRIMARY KEY (' + MysqlModeler.quoteListOrValue(entity.key) + '),\n';

        //other keys
        if (entity.indexes && entity.indexes.length > 0) {
            entity.indexes.forEach(index => {
                sql += '  ';
                if (index.unique) {
                    sql += 'UNIQUE ';
                }
                sql += 'KEY (' + MysqlModeler.quoteListOrValue(index.fields) + '),\n';
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
            obj.map(v => MysqlModeler.quoteIdentifier(v)).join(', ') :
            MysqlModeler.quoteIdentifier(obj);
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
            col = MysqlModeler.intColumnDefinition(field);
                break;

            case 'float':
            case 'decimal':
            col =  MysqlModeler.floatColumnDefinition(field);
                break;

            case 'text':
            col =  MysqlModeler.textColumnDefinition(field);
                break;

            case 'bool':
            col =  MysqlModeler.boolColumnDefinition(field);
                break;

            case 'binary':
            col =  MysqlModeler.binaryColumnDefinition(field);
                break;

            case 'datetime':
            col =  MysqlModeler.datetimeColumnDefinition(field);
                break;

            case 'json':
            col =  MysqlModeler.textColumnDefinition(field);
                break;

            case 'xml':
            col =  MysqlModeler.textColumnDefinition(field);
                break;

            case 'enum':
            col =  MysqlModeler.enumColumnDefinition(field);
                break;

            case 'csv':
            col =  MysqlModeler.textColumnDefinition(field);
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
        return { sql: 'ENUM(' + _.map(info.values, (v) => MysqlModeler.quoteString(v)).join(', ') + ')', type: 'ENUM' };
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

        return OolUtil.entityNaming(entityName);
    };
}

module.exports = MysqlModeler;
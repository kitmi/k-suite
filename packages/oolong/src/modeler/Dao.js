"use strict";

const path = require('path');
const { _, fs, pascalCase, replaceAll }  = require('rk-utils');
const swig  = require('swig-templates');

const OolTypes = require('../lang/OolTypes');
const OolUtil = require('../lang/OolUtils');
const JsLang = require('./util/ast.js');
const OolToAst = require('./util/oolToAst.js');
const Snippets = require('./dao/snippets');

const ChainableType = [
    OolToAst.AST_BLK_VALIDATOR_CALL, 
    OolToAst.AST_BLK_PROCESSOR_CALL,
    OolToAst.AST_BLK_ACTIVATOR_CALL
];

const getFieldName = t => t.split('.').pop();
const isChainable = (current, next) => ChainableType.indexOf(current.type) > -1
    && current.target === next.target
    && next.type === current.type;
const chainCall = (lastBlock, lastType, currentBlock, currentType) => {
    if (lastBlock) {
        if (lastType === 'ValidatorCall') {
            assert: currentType === 'ValidatorCall', 'Unexpected currentType';

            currentBlock = JsLang.astBinExp(lastBlock, '&&', currentBlock);
        } else {
            assert: currentType === 'ModifierCall', 'Unexpected currentType';

            currentBlock.arguments[0] = lastBlock;
        }
    }

    return currentBlock;
};
const asyncMethodNaming = (name) => name + '_';

const indentLines = (lines, indentation) => lines.split('\n').map((line, i) => i === 0 ? line : (_.repeat(' ', indentation) + line)).join('\n');

const OOL_MODIFIER_RETURN = {
    [OolTypes.Modifier.VALIDATOR]: () => [ JsLang.astReturn(true) ],
    [OolTypes.Modifier.PROCESSOR]: args => [ JsLang.astReturn(JsLang.astId(args[0])) ],
    [OolTypes.Modifier.ACTIVATOR]: () => [ JsLang.astReturn(JsLang.astId("undefined")) ]
};

/**
 * Oolong database access object (DAO) modeler.
 * @class
 */
class DaoModeler {
    /**     
     * @param {object} context
     * @property {Logger} context.logger - Logger object          
     * @property {object} context.modelOutputPath - Generated model output path
     * @param {Connector} connector      
     */
    constructor(context, connector) {
        this.logger = context.logger;       
        this.outputPath = context.modelOutputPath;

        this.connector = connector;        
    }

    modeling_(schema) {
        this.logger.log('info', 'Generating entity models for schema "' + schema.name + '"...');

        this._generateSchemaModel(schema);
        this._generateEntityModel(schema);
        //this._generateViewModel();
    }

    _generateSchemaModel(schema) {
        let capitalized = pascalCase(schema.name);

        let locals = {
            className: capitalized,
            dataSource: this.connector.name,
            schemaName: schema.name
        };

        let classTemplate = path.resolve(__dirname, 'database', this.connector.driver, 'Database.js.swig');
        let classCode = swig.renderFile(classTemplate, locals);

        let modelFilePath = path.resolve(this.outputPath, capitalized + '.js');
        fs.ensureFileSync(modelFilePath);
        fs.writeFileSync(modelFilePath, classCode);

        this.logger.log('info', 'Generated database model: ' + modelFilePath);
    }

    _generateEntityModel(schema) {
        _.forOwn(schema.entities, (entity, entityInstanceName) => {
            let capitalized = pascalCase(entityInstanceName);                        

            //shared information with model CRUD and customized interfaces
            let sharedContext = {
                mapOfFunctorToFile: {},
                newFunctorFiles: []
            };

            let { ast: astClassMain, fieldReferences } = this._processFieldModifiers(entity, sharedContext);

            //prepare meta data
            let uniqueKeys = [ _.castArray(entity.key) ];

            if (entity.indexes) {
                entity.indexes.forEach(index => {
                    if (index.unique) {
                        uniqueKeys.push(index.fields);
                    }
                });
            }

            let modelMeta = {
                schemaName: schema.name,
                name: entityInstanceName,
                keyField: entity.key,
                fields: _.mapValues(entity.fields, f => f.toJSON()),
                indexes: entity.indexes || [],
                features: entity.features || [],
                uniqueKeys,
                fieldDependencies: fieldReferences
            };

            //build customized interfaces
            /** 
            if (entity.interfaces) {
                let astInterfaces = this._buildInterfaces(entity, modelMeta, sharedContext);
                let astClass = astClassMain[astClassMain.length - 1];
                JsLang.astPushInBody(astClass, astInterfaces);
            }
            */

            let importLines = [];

            //generate functors if any
            if (!_.isEmpty(sharedContext.mapOfFunctorToFile)) {
                _.forOwn(sharedContext.mapOfFunctorToFile, (fileName, functionName) => {
                    importLines.push(JsLang.astToCode(JsLang.astRequire(functionName, fileName)))
                });
            }

            if (!_.isEmpty(sharedContext.newFunctorFiles)) {
                _.each(sharedContext.newFunctorFiles, entry => {
                    this._generateFunctionTemplateFile(schema, entry);
                });
            }

            //assemble the source code file
            //JsLang.astPushInBody(ast, astClassMain);

            //JsLang.astPushInBody(ast, entity.fields.map((v, k) => JsLang.astAssign(capitalized + '.F_' + _.snakeCase(k).toUpperCase(), k)));   

            let locals = {
                imports: importLines.join('\n'),
                className: capitalized,
                entityMeta: JSON.stringify(modelMeta, null, 4),
                classBody: indentLines(JsLang.astToCode(astClassMain), 4)
            };

            let classTemplate = path.resolve(__dirname, 'database', this.connector.driver, 'EntityModel.js.swig');
            let classCode = swig.renderFile(classTemplate, locals);

            let modelFilePath = path.resolve(this.outputPath, schema.name, capitalized + '.js');
            fs.ensureFileSync(modelFilePath);
            fs.writeFileSync(modelFilePath, classCode);

            this.logger.log('info', 'Generated entity model: ' + modelFilePath);
        });
    };

    /*
    _generateViewModel(schema, dbService) {        
        _.forOwn(schema.views, (viewInfo, viewName) => {
            this.logger.info('Building view: ' + viewName);

            let capitalized = _.upperFirst(viewName);

            let ast = JsLang.astProgram();

            JsLang.astPushInBody(ast, JsLang.astRequire('Mowa', 'mowa'));
            JsLang.astPushInBody(ast, JsLang.astVarDeclare('Util', JsLang.astVarRef('Mowa.Util'), true));
            JsLang.astPushInBody(ast, JsLang.astVarDeclare('_', JsLang.astVarRef('Util._'), true));
            JsLang.astPushInBody(ast, JsLang.astRequire('View', 'mowa/lib/oolong/runtime/view'));

            let compileContext = OolToAst.createCompileContext(viewName, dbService.serviceId, this.logger);

            compileContext.modelVars.add(viewInfo.entity);

            let paramMeta;

            if (viewInfo.params) {
                paramMeta = this._processParams(viewInfo.params, compileContext);
            }

            let viewMeta = {
                isList: viewInfo.isList,
                params: paramMeta
            };

            let viewBodyTopoId = OolToAst.createTopoId(compileContext, '$view');
            OolToAst.dependsOn(compileContext, compileContext.mainStartId, viewBodyTopoId);

            let viewModeler = require(path.resolve(__dirname, './dao/view', dbService.dbType + '.js'));
            compileContext.astMap[viewBodyTopoId] = viewModeler(dbService, viewName, viewInfo);
            OolToAst.addCodeBlock(compileContext, viewBodyTopoId, {
                type: OolToAst.AST_BLK_VIEW_OPERATION
            });

            let returnTopoId = OolToAst.createTopoId(compileContext, '$return:value');
            OolToAst.dependsOn(compileContext, viewBodyTopoId, returnTopoId);
            OolToAst.compileReturn(returnTopoId, {
                "oolType": "ObjectReference",
                "name": "viewData"
            }, compileContext);

            let deps = compileContext.topoSort.sort();
            this.logger.verbose('All dependencies:\n' + JSON.stringify(deps, null, 2));

            deps = deps.filter(dep => compileContext.mapOfTokenToMeta.has(dep));
            this.logger.verbose('All necessary source code:\n' + JSON.stringify(deps, null, 2));

            let astDoLoadMain = [
                JsLang.astVarDeclare('$meta', JsLang.astVarRef('this.meta'), true, false, 'Retrieving the meta data')
            ];

            _.each(deps, dep => {
                let astMeta = compileContext.mapOfTokenToMeta.get(dep);

                let astBlock = compileContext.astMap[dep];
                assert: astBlock, 'Empty ast block';

                if (astMeta.type === 'ModifierCall') {
                    let fieldName = getFieldName(astMeta.target);
                    let astCache = JsLang.astAssign(JsLang.astVarRef(astMeta.target), astBlock, `Modifying ${fieldName}`);
                    astDoLoadMain.push(astCache);
                    return;
                }

                astDoLoadMain = astDoLoadMain.concat(_.castArray(compileContext.astMap[dep]));
            });

            if (!_.isEmpty(compileContext.mapOfFunctorToFile)) {
                _.forOwn(compileContext.mapOfFunctorToFile, (fileName, functionName) => {
                    JsLang.astPushInBody(ast, JsLang.astRequire(functionName, '.' + fileName));
                });
            }

            if (!_.isEmpty(compileContext.newFunctorFiles)) {
                _.each(compileContext.newFunctorFiles, entry => {
                    this._generateFunctionTemplateFile(dbService, entry);
                });
            }

            JsLang.astPushInBody(ast, JsLang.astClassDeclare(capitalized, 'View', [
                JsLang.astMemberMethod('_doLoad', Object.keys(paramMeta),
                    astDoLoadMain,
                    false, true, false, 'Populate view data'
                )
            ], `${capitalized} view`));
            JsLang.astPushInBody(ast, JsLang.astAssign(capitalized + '.meta', JsLang.astValue(viewMeta)));
            JsLang.astPushInBody(ast, JsLang.astAssign('module.exports', JsLang.astVarRef(capitalized)));

            let modelFilePath = path.resolve(this.outputPath, dbService.dbType, dbService.name, 'views', viewName + '.js');
            fs.ensureFileSync(modelFilePath);
            fs.writeFileSync(modelFilePath + '.json', JSON.stringify(ast, null, 2));

            DaoModeler._exportSourceCode(ast, modelFilePath);

            this.logger.log('info', 'Generated view model: ' + modelFilePath);
        });
    };
    */

    _processFieldModifiers(entity, sharedContext) {
        let compileContext = OolToAst.createCompileContext(entity.name, this.logger, sharedContext);

        const allFinished = OolToAst.createTopoId(compileContext, 'done.');

        //map of field name to dependencies
        let fieldReferences = {};

        _.forOwn(entity.fields, (field, fieldName) => {
            let topoId = OolToAst.compileField(fieldName, field, compileContext);
            OolToAst.dependsOn(compileContext, topoId, allFinished);
        });

        let deps = compileContext.topoSort.sort();
        deps = deps.filter(dep => compileContext.mapOfTokenToMeta.has(dep));

        let methodBodyValidateAndFill = [], lastFieldsGroup, 
            methodBodyCache = [], 
            lastBlock, lastAstType;//, hasValidator = false;

        const _mergeDoValidateAndFillCode = function (fieldName, references, astCache, requireTargetField) { 
            let fields = (requireTargetField ? [ fieldName ] : []).concat(references);
            let checker = fields.join(',');

            if (lastFieldsGroup && lastFieldsGroup.checker !== checker) {
                methodBodyValidateAndFill = methodBodyValidateAndFill.concat(
                    Snippets._fieldRequirementCheck(lastFieldsGroup.fieldName, lastFieldsGroup.references, methodBodyCache, lastFieldsGroup.requireTargetField)
                );
                methodBodyCache = [];
            }

            methodBodyCache = methodBodyCache.concat(astCache);
            lastFieldsGroup = {
                fieldName,
                references,
                requireTargetField,                
                checker,
            }
        };

        //console.dir(compileContext.astMap['mobile~isMobilePhone:arg[1]|>stringDasherize'], { depth: 8 }); 

        _.each(deps, (dep, i) => {
            let sourceMap = compileContext.mapOfTokenToMeta.get(dep);
            let astBlock = compileContext.astMap[dep];

            let targetFieldName = getFieldName(sourceMap.target);            

            if (sourceMap.references) {
                let fieldReference = fieldReferences[targetFieldName];
                if (!fieldReference) {
                    fieldReferences[targetFieldName] = fieldReference = [];
                }

                sourceMap.references.forEach(ref => { if (fieldReference.indexOf(ref) === -1) fieldReference.push(ref); });
            }

            if (lastBlock) {
                astBlock = chainCall(lastBlock, lastAstType, astBlock, sourceMap.type);
                lastBlock = undefined;
            }

            if (i < deps.length-1) {
                let nextType = compileContext.mapOfTokenToMeta.get(deps[i+1]);

                if (isChainable(sourceMap, nextType)) {
                    lastBlock = astBlock;
                    lastAstType = sourceMap.type;
                    return;
                }
            }            

            if (sourceMap.type === OolToAst.AST_BLK_VALIDATOR_CALL) {
                //hasValidator = true;
                let astCache = Snippets._validateCheck(targetFieldName, astBlock);
                
                _mergeDoValidateAndFillCode(targetFieldName, sourceMap.references, astCache, true);                                
            } else if (sourceMap.type === OolToAst.AST_BLK_PROCESSOR_CALL) {
                let astCache = JsLang.astAssign(JsLang.astVarRef(sourceMap.target, true), astBlock, `Processing "${targetFieldName}"`);
                
                _mergeDoValidateAndFillCode(targetFieldName, sourceMap.references, astCache, true);
            } else if (sourceMap.type === OolToAst.AST_BLK_ACTIVATOR_CALL) {
                let astCache = JsLang.astAssign(JsLang.astVarRef(sourceMap.target, true), astBlock, `Activating "${targetFieldName}"`);
                
                _mergeDoValidateAndFillCode(targetFieldName, sourceMap.references, astCache, false);
            } else {
                throw new Error('To be implemented.');
                //astBlock = _.castArray(astBlock);                
                //_mergeDoValidateAndFillCode(targetFieldName, [], astBlock);                                
            }
        });

        /* Changed to throw error instead of returning a error object
        if (hasValidator) {
            let declare = JsLang.astVarDeclare(validStateName, false);
            methodBodyCreate.unshift(declare);
            methodBodyUpdate.unshift(declare);
        }
        */

        if (!_.isEmpty(methodBodyCache)) {
            methodBodyValidateAndFill = methodBodyValidateAndFill.concat(
                Snippets._fieldRequirementCheck(lastFieldsGroup.fieldName, 
                    lastFieldsGroup.references, 
                    methodBodyCache, 
                    lastFieldsGroup.requireTargetField
                    ));
        }      
        
        /*
        let ast = JsLang.astProgram(false);
        JsLang.astPushInBody(ast, JsLang.astClassDeclare('Abc', 'Model', [
            JsLang.astMemberMethod(asyncMethodNaming('prepareEntityData_'), [ 'context' ],
            Snippets._doValidateAndFillHeader.concat(methodBodyValidateAndFill).concat([ JsLang.astReturn(JsLang.astId('context')) ]),
            false, true, true
        )], 'comment'));
        */

        return { ast: JsLang.astMemberMethod(asyncMethodNaming('applyModifiers'), [ 'context', 'isUpdating' ],
            Snippets._applyModifiersHeader.concat(methodBodyValidateAndFill).concat([ JsLang.astReturn(JsLang.astId('context')) ]),
            false, true, true, 'Applying predefined modifiers to entity fields.'
        ), fieldReferences };
    }

    _generateFunctionTemplateFile(schema, { functionName, functorType, fileName, args }) {
        let filePath = path.resolve(
            this.outputPath,
            schema.name,
            fileName
        );

        if (fs.existsSync(filePath)) {
            //todo: analyse code, compare arguments
            this.logger.log('info', `${ _.upperFirst(functorType) } "${fileName}" exists. File generating skipped.`);

            return;
        }

        let ast = JsLang.astProgram();
        
        JsLang.astPushInBody(ast, JsLang.astFunction(functionName, args, OOL_MODIFIER_RETURN[functorType](args)));
        JsLang.astPushInBody(ast, JsLang.astAssign('module.exports', JsLang.astVarRef(functionName)));

        fs.ensureFileSync(filePath);
        fs.writeFileSync(filePath, JsLang.astToCode(ast));
        this.logger.log('info', `Generated ${ functorType } file: ${filePath}`);
    }

    _buildInterfaces(entity, dbService, modelMetaInit, sharedContext) {
        let ast = [];

        _.forOwn(entity.interfaces, (method, name) => {
            this.logger.info('Building interface: ' + name);

            let astBody = [
                JsLang.astVarDeclare('$meta', JsLang.astVarRef('this.meta.interfaces.' + name), true, false, 'Retrieving the meta data')
            ];

            let compileContext = OolToAst.createCompileContext(entity.name, this.logger, sharedContext);

            //scan all used models in advance
            _.each(method.implementation, (operation) => {
                compileContext.modelVars.add(operation.model);
            });
            
            let paramMeta;

            if (method.accept) {
                paramMeta = this._processParams(method.accept, compileContext);
            }            

            //metadata
            modelMetaInit['interfaces'] || (modelMetaInit['interfaces'] = {});
            modelMetaInit['interfaces'][name] = { params: Object.values(paramMeta) };

            _.each(method.implementation, (operation, index) => {
                //let lastTopoId = 
                OolToAst.compileDbOperation(index, operation, compileContext, compileContext.mainStartId);                
            });

            if (method.return) {
                OolToAst.compileExceptionalReturn(method.return, compileContext);
            }

            let deps = compileContext.topoSort.sort();
            this.logger.verbose('All dependencies:\n' + JSON.stringify(deps, null, 2));

            deps = deps.filter(dep => compileContext.mapOfTokenToMeta.has(dep));
            this.logger.verbose('All necessary source code:\n' + JSON.stringify(deps, null, 2));

            _.each(deps, dep => {
                let sourceMap = compileContext.mapOfTokenToMeta.get(dep);
                let astBlock = compileContext.astMap[dep];

                this.logger.verbose('Code point "' + dep + '":\n' + JSON.stringify(sourceMap, null, 2));

                if (sourceMap.type === OolToAst.AST_BLK_MODIFIER_CALL) {
                    let fieldName = getFieldName(sourceMap.target);
                    let astCache = JsLang.astAssign(JsLang.astVarRef(sourceMap.target), astBlock, `Modifying ${fieldName}`);
                    astBody = astBody.concat(_.castArray(astCache));
                    return;
                }

                astBody = astBody.concat(_.castArray(astBlock));
            });
            
            ast.push(JsLang.astMemberMethod(asyncMethodNaming(name), Object.keys(paramMeta), astBody, false, true, true, replaceAll(_.kebabCase(name), '-', ' ')));
        });

        return ast;
    };

    _processParams(acceptParams, compileContext) {
        let paramMeta = {};

        acceptParams.forEach((param, i) => {
            OolToAst.compileParam(i, param, compileContext);
            paramMeta[param.name] = _.omit(param, OolUtil.FUNCTORS_LIST.concat(['subClass']));
        });

        return paramMeta;
    };
}

module.exports = DaoModeler;
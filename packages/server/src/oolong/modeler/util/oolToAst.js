"use strict";

/**
 * @module
 * @ignore
 */

const Util = require('../../../util.js');
const _ = Util._;
const S = Util.S;
const JsLang = require('./ast.js');
const OolUtil = require('../../lang/ool-utils.js');
const OolongModifiers = require('../../runtime/modifiers.js');
const OolongValidators = require('../../runtime/validators.js');
const OolongComposers = require('../../runtime/composers.js');
const Types = require('../../runtime/types.js');

const defaultError = 'InvalidRequest';

const AST_BLK_FIELD_PRE_PROCESS = 'FieldPreProcess';
const AST_BLK_PARAM_SANITIZE = 'ParameterSanitize';
const AST_BLK_MODIFIER_CALL = 'ModifierCall';
const AST_BLK_VALIDATOR_CALL = 'ValidatorCall';
const AST_BLK_COMPOSOR_CALL = 'ComposerCall';
const AST_BLK_VIEW_OPERATION = 'ViewOperation';
const AST_BLK_VIEW_RETURN = 'ViewReturn';
const AST_BLK_INTERFACE_OPERATION = 'InterfaceOperation';
const AST_BLK_INTERFACE_RETURN = 'InterfaceReturn';
const AST_BLK_EXCEPTION_ITEM = 'ExceptionItem';

const OOL_FUNCTOR_MAP = {
    [OolUtil.FUNCTOR_VALIDATOR]: AST_BLK_VALIDATOR_CALL,
    [OolUtil.FUNCTOR_MODIFIER]: AST_BLK_MODIFIER_CALL,
    [OolUtil.FUNCTOR_COMPOSER]: AST_BLK_COMPOSOR_CALL
};

//[ JsLang.astReturn(true) ] : 
const OOL_FUNCTOR_RETURN = {
    [OolUtil.FUNCTOR_VALIDATOR]: () => [ JsLang.astReturn(true) ],
    [OolUtil.FUNCTOR_MODIFIER]: args => [ JsLang.astReturn(JsLang.astId(args[0])) ],
    [OolUtil.FUNCTOR_COMPOSER]: () => [ JsLang.astReturn(JsLang.astId("undefined")) ]
};

/**
 * Compile a conditional expression
 * @param {object} test
 * @param {object} compileContext
 * @property {string} compileContext.targetName
 * @property {TopoSort} compileContext.topoSort
 * @property {object} compileContext.astMap - Topo Id to ast map
 * @param {string} startTopoId
 * @returns {string} Topo Id
 */
function compileConditionalExpression(test, compileContext, startTopoId) {
    if (_.isPlainObject(test)) {
        if (test.oolType === 'BinaryExpression') {
            let endTopoId = createTopoId(compileContext, startTopoId + '$binOp:done');

            let op;

            switch (test.operator) {
                case '>':
                case '<':
                case '>=':
                case '<=':
                case 'in':
                    op = test.operator;
                    break;

                case 'and':
                    op = '&&';
                    break;

                case 'or':
                    op = '||';
                    break;

                case '=':
                    op = '===';
                    break;

                case '!=':
                    op = '!==';
                    break;

                default:
                    throw new Error('Unsupported test operator: ' + test.operator);
            }

            let leftTopoId = createTopoId(compileContext, startTopoId + '$binOp:left');
            let rightTopoId = createTopoId(compileContext, startTopoId + '$binOp:right');

            dependsOn(compileContext, startTopoId, leftTopoId);
            dependsOn(compileContext, startTopoId, rightTopoId);

            let lastLeftId = compileConditionalExpression(test.left, compileContext, leftTopoId);
            let lastRightId = compileConditionalExpression(test.right, compileContext, rightTopoId);

            dependsOn(compileContext, lastLeftId, endTopoId);
            dependsOn(compileContext, lastRightId, endTopoId);

            compileContext.astMap[endTopoId] = JsLang.astBinExp(
                getCodeRepresentationOf(lastLeftId, compileContext),
                op,
                getCodeRepresentationOf(lastRightId, compileContext)
            ); 

            return endTopoId;

        } else if (test.oolType === 'UnaryExpression') {
            let endTopoId = createTopoId(compileContext, startTopoId + '$unaOp:done');
            let operandTopoId = createTopoId(compileContext, startTopoId + '$unaOp');

            dependsOn(compileContext, startTopoId, operandTopoId);

            let lastOperandTopoId = compileConditionalExpression(test.argument, compileContext, operandTopoId);
            dependsOn(compileContext, lastOperandTopoId, endTopoId);

            let astArgument = getCodeRepresentationOf(lastOperandTopoId, compileContext);

            switch (test.operator) {
                case 'exists':
                    compileContext.astMap[endTopoId] = JsLang.astNot(JsLang.astCall('_.isEmpty', astArgument));
                    break;

                case 'is-not-null':
                    compileContext.astMap[endTopoId] = JsLang.astNot(JsLang.astCall('_.isNil', astArgument));
                    break;

                case 'not-exists':
                    compileContext.astMap[endTopoId] = JsLang.astCall('_.isEmpty', astArgument);
                    break;

                case 'is-null':
                    compileContext.astMap[endTopoId] = JsLang.astCall('_.isNil', astArgument);
                    break;

                case 'not':
                    compileContext.astMap[endTopoId] = JsLang.astNot(astArgument);
                    break;

                default:
                    throw new Error('Unsupported test operator: ' + test.operator);
            }

            return endTopoId;

        } else {
            let valueStartTopoId = createTopoId(compileContext, startTopoId + '$value');
            dependsOn(compileContext, startTopoId, valueStartTopoId);
            return compileConcreteValueExpression(valueStartTopoId, test, compileContext);
        } 
    }

    compileContext.astMap[startTopoId] = JsLang.astValue(test);
    return startTopoId;
}

/**
 * Compile a functor from ool to ast.
 * @param value
 * @param functors
 * @param compileContext
 * @param topoInfo
 * @property {string} topoInfo.topoIdPrefix
 * @property {string} topoInfo.lastTopoId
 * @param {string} functorType
 * @returns {*|string}
 */
function compileFunctor(value, functors, compileContext, topoInfo, functorType) {
    let l = functors.length;
    let lastTopoId = topoInfo.lastTopoId;

    for (let i = 0; i < l; i++) {
        let functor = functors[i];
        let declareParams;

        if (functorType === OolUtil.FUNCTOR_COMPOSER) { 
            declareParams = translateFunctionParams(functor.args);        
        } else {
            declareParams = translateFunctionParams([value].concat(functor.args));        
        }        

        let functorId = translateFunctor(functor, functorType, compileContext, declareParams);
        let topoId = createTopoId(compileContext, topoInfo.topoIdPrefix + '[' + i.toString() + ']' + functorId);

        let callArgs, references;
        
        if (functor.args) {
            callArgs = translateArgs(topoId, functor.args, compileContext);
            references = extractReferencedLatestFields(functor.args);

            if (_.find(references, ref => ref === value.name)) {
                throw new Error('Cannot use the target field itself as an argument of a validator or modifier.');
            }
        } else {
            callArgs = [];
        }        
        
        if (functorType === OolUtil.FUNCTOR_COMPOSER) {            
            compileContext.astMap[topoId] = JsLang.astCall(functorId, callArgs);
        } else {
            compileContext.astMap[topoId] = JsLang.astCall(functorId, [ value ].concat(callArgs));
        }
        

        if (lastTopoId) {
            dependsOn(compileContext, lastTopoId, topoId);
        }

        lastTopoId = topoId;

        if (topoId.indexOf(':arg[') === -1 && topoId.indexOf('$cases[') === -1 && topoId.indexOf('$exceptions[') === -1) {
            addCodeBlock(compileContext, topoId, {
                type: OOL_FUNCTOR_MAP[functorType],
                target: value.name,
                references: references
            });
        }
    }

    return lastTopoId;
}

function extractReferencedLatestFields(oolArgs) {    
    if (!Array.isArray(oolArgs)) {
        return [ checkReferenceToLatestField(oolArgs) ];
    }

    let refs = [];

    oolArgs.forEach(a => {
        let result = checkReferenceToLatestField(a);
        if (result) {
            refs.push(result);
        }
    });

    return refs;
}

function checkReferenceToLatestField(obj) {
    if (_.isPlainObject(obj) && obj.oolType) {
        if (obj.oolType === 'PipedValue') return checkReferenceToLatestField(obj.value);
        if (obj.oolType === 'ObjectReference') {
            let ns = obj.name.split('.');
            if (ns.length === 2 && ns[0].trim() === 'latest') return ns[1].trim();
        }
    }

    return undefined;
}

function addFunctorToMap(functorId, functorType, functorJsFile, mapOfFunctorToFile) {
    if (mapOfFunctorToFile[functorId] && mapOfFunctorToFile[functorId] !== functorJsFile) {
        throw new Error(`Conflict: ${functorType} naming "${functorId}" conflicts!`);
    }
    mapOfFunctorToFile[functorId] = functorJsFile;
}

/**
 * Check whether a functor is user-defined or built-in
 * @param functor
 * @param functorType
 * @param compileContext
 * @param args
 * @returns {string} functor id
 */
function translateFunctor(functor, functorType, compileContext, args) {
    let functionName, fileName, functorId;

    //extract validator naming and import information
    if (OolUtil.isMemberAccess(functor.name)) {
        let names = OolUtil.extractMemberAccess(functor.name);
        if (names.length > 2) {
            throw new Error('Not supported reference type: ' + functor.name);
        }

        //reference to other entity file
        let refEntityName = names[0];
        functionName = names[1];
        fileName = './' + functorType + 's/' + refEntityName + '-' + functionName + '.js';
        functorId = refEntityName + _.upperFirst(functionName);
        addFunctorToMap(functorId, functorType, fileName, compileContext.mapOfFunctorToFile);

    } else {
        functionName = functor.name;

        let builtins;

        switch (functorType) {
            case OolUtil.FUNCTOR_VALIDATOR:
                builtins = OolongValidators;
                break;
            
            case OolUtil.FUNCTOR_MODIFIER:
                builtins = OolongModifiers;
                break;

            case OolUtil.FUNCTOR_COMPOSER:
                builtins = OolongComposers;
                break;    

            default:
                throw new Error('Not supported!');
        }

        if (!(functionName in builtins)) {
            fileName = './' + functorType + 's/' + compileContext.targetName + '-' + functionName + '.js';
            functorId = functionName;
            addFunctorToMap(functorId, functorType, fileName, compileContext.mapOfFunctorToFile);

            compileContext.newFunctorFiles.push({
                functionName,
                functorType,
                fileName,
                args
            });
        } else {
            functorId = functorType + 's.' + functionName;
        }
    }

    return functorId;
}

/**
 * Compile a variable reference from ool to ast.
 * @param {string} startTopoId - The topological id of the starting process to the target value
 * @param {object} varOol - Target value ool node.
 * @param {object} compileContext - Compilation context.
 * @property {string} compileContext.targetName
 * @property {TopoSort} compileContext.topoSort
 * @property {object} compileContext.astMap - Topo Id to ast map
 * @returns {string} Last topo Id
 */
function compileVariableReference(startTopoId, varOol, compileContext) {
    pre: _.isPlainObject(varOol) && varOol.oolType === 'ObjectReference', Util.Message.DBC_INVALID_ARG;

    let lastTopoId = startTopoId;

    let [ baseName, others ] = varOol.name.split('.', 2);
    if (compileContext.modelVars && compileContext.modelVars.has(baseName) && others) {
        varOol.name = baseName + '.data' + '.' + others;
    }

    let simpleValue = true;

    if (varOol.computedBy) {
        lastTopoId = compileFunctor(
            varOol,
            [ varOol.computedBy ],
            compileContext,
            { topoIdPrefix: startTopoId + ':by=', lastTopoId },
            OolUtil.FUNCTOR_COMPOSER
        );
        simpleValue = false;
    }

    if (!_.isEmpty(varOol.validators0)) {
        lastTopoId = compileFunctor(
            varOol,
            varOol.validators0,
            compileContext,
            { topoIdPrefix: startTopoId + ':stage0~', lastTopoId },
            OolUtil.FUNCTOR_VALIDATOR
        );
        simpleValue = false;
    }

    if (!_.isEmpty(varOol.modifiers0)) {
        lastTopoId = compileFunctor(
            varOol,
            varOol.modifiers0,
            compileContext,
            { topoIdPrefix: startTopoId + ':stage0|', lastTopoId },
            OolUtil.FUNCTOR_MODIFIER
        );
        simpleValue = false;
    }

    if (!_.isEmpty(varOol.validators1)) {
        lastTopoId = compileFunctor(
            varOol,
            varOol.validators1,
            compileContext,
            { topoIdPrefix: startTopoId + ':stage1~', lastTopoId },
            OolUtil.FUNCTOR_VALIDATOR
        );
        simpleValue = false;
    }

    if (!_.isEmpty(varOol.modifiers1)) {
        lastTopoId = compileFunctor(
            varOol,
            varOol.modifiers1,
            compileContext,
            { topoIdPrefix: startTopoId + ':stage1|', lastTopoId },
            OolUtil.FUNCTOR_MODIFIER
        );
        simpleValue = false;
    }

    if (!simpleValue) {
        return lastTopoId;
    }

    //simple value
    compileContext.astMap[startTopoId] = JsLang.astValue(varOol);
    return startTopoId;
}

/**
 * Get an array of parameter names.
 * @param {array} args - An array of arguments in ool syntax
 * @returns {array}
 */
function translateFunctionParams(args) {
    if (_.isEmpty(args)) return [];

    return _.map(args, (arg, i) => {
        if (_.isPlainObject(arg) && arg.oolType === 'ObjectReference') {
            if (OolUtil.isMemberAccess(arg.name)) {
                return OolUtil.extractMemberAccess(arg.name).pop();
            }

            return arg.name;
        }

        return 'param' + (i + 1).toString();
    });
}

/**
 * Compile a concrete value expression from ool to ast
 * @param {string} startTopoId - The topo id of the starting process to the target value expression
 * @param {object} value - Ool node
 * @param {object} compileContext - Compilation context
 * @returns {string} Last topoId
 */
function compileConcreteValueExpression(startTopoId, value, compileContext) {
    if (_.isPlainObject(value)) {
        if (value.oolType === 'PipedValue') {
            value = { ..._.omit(value, ['value']), ...value.value };
        }

        if (value.oolType === 'ObjectReference') {
            let [ refBase, ...rest ] = OolUtil.extractMemberAccess(value.name);

            let dependency;

            if (compileContext.modelVars && compileContext.modelVars.has(refBase)) {
                //user, user.password or user.data.password
                dependency = refBase;
            } else if (refBase === 'latest' && rest.length > 0) {
                //latest.password
                dependency = rest.pop() + ':ready';
            } else if (_.isEmpty(rest)) {
                dependency = refBase + ':ready';
            } else {
                throw new Error('mark');
            }

            dependsOn(compileContext, dependency, startTopoId);

            return compileVariableReference(startTopoId, value, compileContext);
        }
        
        value = _.mapValues(value, (valueOfElement, key) => { 
            let sid = createTopoId(compileContext, startTopoId + '.' + key);
            let eid = compileConcreteValueExpression(sid, valueOfElement, compileContext);
            if (sid !== eid) {
                dependsOn(compileContext, eid, startTopoId);
            }
            return compileContext.astMap[eid];
        });
    } else if (Array.isArray(value)) {
        value = _.map(value, (valueOfElement, index) => { 
            let sid = createTopoId(compileContext, startTopoId + '[' + index + ']');
            let eid = compileConcreteValueExpression(sid, valueOfElement, compileContext);
            if (sid !== eid) {
                dependsOn(compileContext, eid, startTopoId);
            }
            return compileContext.astMap[eid];
        });
    }

    compileContext.astMap[startTopoId] = JsLang.astValue(value);
    return startTopoId;
}

/**
 * Translate an array of function arguments from ool into ast
 * @param topoId
 * @param args
 * @param compileContext
 * @returns {Array}
 */
function translateArgs(topoId, args, compileContext) {
    args = _.castArray(args);
    if (_.isEmpty(args)) return [];

    let callArgs = [];

    _.each(args, (arg, i) => {
        let argTopoId = createTopoId(compileContext, topoId + ':arg[' + (i+1).toString() + ']');
        let lastTopoId = compileConcreteValueExpression(argTopoId, arg, compileContext);

        dependsOn(compileContext, lastTopoId, topoId);

        callArgs = callArgs.concat(_.castArray(getCodeRepresentationOf(lastTopoId, compileContext)));
    });

    return callArgs;
}

/**
 * Compile a param of interface from ool into ast
 * @param index
 * @param param
 * @param compileContext
 * @returns {string}
 */
function compileParam(index, param, compileContext) {
    let type = param.type;

    let sanitizerName;

    switch (type) {
        case Types.TYPE_INT:
            sanitizerName = 'validators.$processInt';
            break;
        case Types.TYPE_FLOAT:
            sanitizerName = 'validators.$processFloat';
            break;
        case Types.TYPE_BOOL:
            sanitizerName = 'validators.$processBool';
            break;
        case Types.TYPE_TEXT:
            sanitizerName = 'validators.$processText';
            break;
        case Types.TYPE_BINARY:
            sanitizerName = 'validators.$processBinary';
            break;
        case Types.TYPE_DATETIME:
            sanitizerName = 'validators.$processDatetime';
            break;
        case Types.TYPE_JSON:
            sanitizerName = 'validators.$processJson';
            break;
        case Types.TYPE_XML:
            sanitizerName = 'validators.$processXml';
            break;
        case Types.TYPE_ENUM:
            sanitizerName = 'validators.$processEnum';
            break;
        case Types.TYPE_CSV:
            sanitizerName = 'validators.$processCsv';
            break;
        default:
            throw new Error('Unknown field type: ' + type);
    }

    let varRef = JsLang.astVarRef('$sanitizeState');
    let callAst = JsLang.astCall(sanitizerName, [JsLang.astArrayAccess('$meta.params', index), JsLang.astVarRef(param.name)]);

    let prepareTopoId = createTopoId(compileContext, '$params:sanitize[' + index.toString() + ']');
    let sanitizeStarting;

    if (index === 0) {
        //declare $sanitizeState variable for the first time
        sanitizeStarting = JsLang.astVarDeclare(varRef, callAst, false, false, `Sanitize param "${param.name}"`);
    } else {
        sanitizeStarting = JsLang.astAssign(varRef, callAst, `Sanitize param "${param.name}"`);

        let lastPrepareTopoId = '$params:sanitize[' + (index - 1).toString() + ']';
        dependsOn(compileContext, lastPrepareTopoId, prepareTopoId);
    }

    compileContext.astMap[prepareTopoId] = [
        sanitizeStarting,        
        JsLang.astAssign(JsLang.astVarRef(param.name),
            JsLang.astVarRef('$sanitizeState.sanitized'))
    ];

    addCodeBlock(compileContext, prepareTopoId, {
        type: AST_BLK_PARAM_SANITIZE
    });

    dependsOn(compileContext, prepareTopoId, compileContext.mainStartId);

    let topoId = createTopoId(compileContext, param.name);
    dependsOn(compileContext, compileContext.mainStartId, topoId);

    let value = normalizeVariableReference(param.name, param);
    let endTopoId = compileVariableReference(topoId, value, compileContext);

    let readyTopoId = createTopoId(compileContext, topoId + ':ready');
    dependsOn(compileContext, endTopoId, readyTopoId);

    return readyTopoId;
}

/**
 * Compile a model field preprocess information into ast.
 * @param {object} param - Field information
 * @param {object} compileContext - Compilation context
 * @returns {string}
 */
function compileField(param, compileContext) {
    let topoId = createTopoId(compileContext, param.name);
    let contextName = 'latest.' + param.name;
    compileContext.astMap[topoId] = JsLang.astVarRef(contextName);

    let value = normalizeVariableReference(contextName, param);
    let endTopoId = compileVariableReference(topoId, value, compileContext);

    let readyTopoId = createTopoId(compileContext, topoId + ':ready');
    dependsOn(compileContext, endTopoId, readyTopoId);

    return readyTopoId;
}

function normalizeVariableReference(name, value) {
    return Object.assign({ oolType: 'ObjectReference', name: name },
        _.pick(value, OolUtil.FUNCTORS_LIST));
}

/**
 * Translate a then clause from ool into ast
 * @param {string} startId
 * @param {string} endId
 * @param then
 * @param compileContext
 * @param assignTo
 * @returns {object} AST object
 */
function translateThenAst(startId, endId, then, compileContext, assignTo) {
    if (_.isPlainObject(then)) {
        if (then.oolType === 'ThrowExpression') {
            return JsLang.astThrow(then.errorType || defaultError, then.message || []);
        }

        if (then.oolType === 'ReturnExpression') {
            return translateReturnValueAst(startId, endId, then.value, compileContext);
        }        
    }

    //then expression is an oolong concrete value    
    if (_.isArray(then) || _.isPlainObject(then)) {
        let valueEndId = compileConcreteValueExpression(startId, then, compileContext);    
        then = compileContext.astMap[valueEndId]; 
    }   

    if (!assignTo) {
        return JsLang.astReturn(then);
    }

    return JsLang.astAssign(assignTo, then);
}

/**
 * Translate a return clause from ool into ast
 * @param {string} startTopoId - The topo id of the starting state of return clause
 * @param {string} endTopoId - The topo id of the ending state of return clause
 * @param value
 * @param compileContext
 * @returns {object} AST object
 */
function translateReturnValueAst(startTopoId, endTopoId, value, compileContext) {
    let valueTopoId = compileConcreteValueExpression(startTopoId, value, compileContext);
    if (valueTopoId !== startTopoId) {
        dependsOn(compileContext, valueTopoId, endTopoId);
    }

    return JsLang.astReturn(getCodeRepresentationOf(valueTopoId, compileContext));
}

/**
 * Compile a return clause from ool into ast
 * @param {string} startTopoId - The topo id of the starting process to the target value expression
 * @param value
 * @param compileContext
 * @returns {object} AST object
 */
function compileReturn(startTopoId, value, compileContext) {
    let endTopoId = createTopoId(compileContext, '$return');
    dependsOn(compileContext, startTopoId, endTopoId);

    compileContext.astMap[endTopoId] = translateReturnValueAst(startTopoId, endTopoId, value, compileContext);

    addCodeBlock(compileContext, endTopoId, {
        type: AST_BLK_VIEW_RETURN
    });

    return endTopoId;
}

/**
 * Compile a find one operation from ool into ast
 * @param {int} index
 * @param {object} operation - Ool node
 * @param {object} compileContext -
 * @param {string} dependency
 * @returns {string} last topoId
 */
function compileFindOne(index, operation, compileContext, dependency) {
    pre: dependency, Util.Message.DBC_ARG_REQUIRED;

    let endTopoId = createTopoId(compileContext, 'op$' + index.toString());
    let conditionVarName = endTopoId + '$condition';

    let ast = [
        JsLang.astVarDeclare(conditionVarName)
    ];

    if (operation.case) {
        let topoIdPrefix = endTopoId + '$cases';
        let lastStatement;

        if (operation.case.else) {
            let elseStart = createTopoId(compileContext, topoIdPrefix + ':else');
            let elseEnd = createTopoId(compileContext, topoIdPrefix + ':end');
            dependsOn(compileContext, elseStart, elseEnd);
            dependsOn(compileContext, elseEnd, endTopoId);

            lastStatement = translateThenAst(elseStart, elseEnd, operation.case.else, compileContext, conditionVarName);
        } else {
            lastStatement = JsLang.astThrow('ServerError', 'Unexpected state.');
        }

        if (_.isEmpty(operation.case.items)) {
            throw new Error('Missing case items');
        }

        _.reverse(operation.case.items).forEach((item, i) => {
            if (item.oolType !== 'ConditionalStatement') {
                throw new Error('Invalid case item.');
            }

            i = operation.case.items.length - i - 1;

            let casePrefix = topoIdPrefix + '[' + i.toString() + ']';
            let caseTopoId = createTopoId(compileContext, casePrefix);
            dependsOn(compileContext, dependency, caseTopoId);

            let caseResultVarName = '$' + topoIdPrefix + '_' + i.toString();

            let lastTopoId = compileConditionalExpression(item.test, compileContext, caseTopoId);
            let astCaseTtem = getCodeRepresentationOf(lastTopoId, compileContext);

            assert: !Array.isArray(astCaseTtem), 'Invalid case item ast.';

            astCaseTtem = JsLang.astVarDeclare(caseResultVarName, astCaseTtem, true, false, `Condition ${i} for find one ${operation.model}`);

            let ifStart = createTopoId(compileContext, casePrefix + ':then');
            let ifEnd = createTopoId(compileContext, casePrefix + ':end');
            dependsOn(compileContext, lastTopoId, ifStart);
            dependsOn(compileContext, ifStart, ifEnd);

            lastStatement = [
                astCaseTtem,
                JsLang.astIf(JsLang.astVarRef(caseResultVarName), JsLang.astBlock(translateThenAst(ifStart, ifEnd, item.then, compileContext, conditionVarName)), lastStatement)
            ];
            dependsOn(compileContext, ifEnd, endTopoId);
        });

        ast = ast.concat(_.castArray(lastStatement));
    } else if (operation.condition) {
        throw new Error('operation.condition tbi');
    } else {
        throw new Error('tbi');
    }

    ast.push(
        JsLang.astVarDeclare(operation.model, JsLang.astAwait(`this.findOne_`, JsLang.astVarRef(conditionVarName)))
    );

    let modelTopoId = createTopoId(compileContext, operation.model);
    dependsOn(compileContext, endTopoId, modelTopoId);
    compileContext.astMap[endTopoId] = ast;
    return endTopoId;
}

function compileDbOperation(index, operation, compileContext, dependency) {
    let lastTopoId;

    switch (operation.oolType) {
        case 'findOne':
            lastTopoId = compileFindOne(index, operation, compileContext, dependency);
            break;

        case 'find':
            //prepareDbConnection(compileContext);
            throw new Error('tbi');
            break;

        case 'update':
            throw new Error('tbi');
            //prepareDbConnection(compileContext);
            break;

        case 'create':
            throw new Error('tbi');
            //prepareDbConnection(compileContext);
            break;

        case 'delete':
            throw new Error('tbi');
            //prepareDbConnection(compileContext);
            break;

        case 'javascript':
            throw new Error('tbi');
            break;

        case 'assignment':
            throw new Error('tbi');
            break;

        default:
            throw new Error('Unsupported operation type: ' + operation.type);
    }

    addCodeBlock(compileContext, lastTopoId, {
        type: AST_BLK_INTERFACE_OPERATION
    });

    return lastTopoId;
}

/**
 * Compile exceptional return 
 * @param {object} oolNode
 * @param {object} compileContext
 * @param {string} [dependency]
 * @returns {string} last topoId
 */
function compileExceptionalReturn(oolNode, compileContext, dependency) {
    pre: (_.isPlainObject(oolNode) && oolNode.oolType === 'ReturnExpression'), Util.Message.DBC_INVALID_ARG;

    let endTopoId = createTopoId(compileContext, '$return'), lastExceptionId = dependency;

    if (!_.isEmpty(oolNode.exceptions)) {
        oolNode.exceptions.forEach((item, i) => {
            if (_.isPlainObject(item)) {
                if (item.oolType !== 'ConditionalStatement') {
                    throw new Error('Unsupported exceptional type: ' + item.oolType);
                }

                let exceptionStartId = createTopoId(compileContext, endTopoId + ':except[' + i.toString() + ']');
                let exceptionEndId = createTopoId(compileContext, endTopoId + ':except[' + i.toString() + ']:done');
                if (lastExceptionId) {
                    dependsOn(compileContext, lastExceptionId, exceptionStartId);
                }

                let lastTopoId = compileConditionalExpression(item.test, compileContext, exceptionStartId);

                let thenStartId = createTopoId(compileContext, exceptionStartId + ':then');
                dependsOn(compileContext, lastTopoId, thenStartId);
                dependsOn(compileContext, thenStartId, exceptionEndId);

                compileContext.astMap[exceptionEndId] = JsLang.astIf(
                    getCodeRepresentationOf(lastTopoId, compileContext),
                    JsLang.astBlock(translateThenAst(
                        thenStartId,
                        exceptionEndId,
                        item.then, compileContext)),
                    null,
                    `Return on exception #${i}`
                );

                addCodeBlock(compileContext, exceptionEndId, {
                    type: AST_BLK_EXCEPTION_ITEM
                });

                lastExceptionId = exceptionEndId;
            } else {
                throw new Error('Unexpected.');
            }
        });
    }

    dependsOn(compileContext, lastExceptionId, endTopoId);

    let returnStartTopoId = createTopoId(compileContext, '$return:value');
    dependsOn(compileContext, returnStartTopoId, endTopoId);

    compileContext.astMap[endTopoId] = translateReturnValueAst(returnStartTopoId, endTopoId, oolNode.value, compileContext);

    addCodeBlock(compileContext, endTopoId, {
        type: AST_BLK_INTERFACE_RETURN
    });
    
    return endTopoId;
}

function createTopoId(compileContext, name) {
    if (compileContext.topoNodes.has(name)) {
        throw new Error(`Topo id "${name}" already created.`);
    }

    assert: !compileContext.topoSort.hasDependency(name), 'Already in topoSort!';

    compileContext.topoNodes.add(name);

    return name;
}

function dependsOn(compileContext, previousOp, currentOp) {
    pre: previousOp !== currentOp, 'Self depending';

    compileContext.logger.debug(currentOp + ' \x1b[33mdepends on\x1b[0m ' + previousOp);

    if (!compileContext.topoNodes.has(currentOp)) {
        throw new Error(`Topo id "${currentOp}" not created.`);
    }

    compileContext.topoSort.add(previousOp, currentOp);
}

function addCodeBlock(compileContext, topoId, blockMeta) {
    if (!(topoId in compileContext.astMap)) {
        throw new Error(`AST not found for block with topoId: ${topoId}`);
    }

    compileContext.sourceMap.set(topoId, blockMeta);

    compileContext.logger.verbose(`Adding ${blockMeta.type} "${topoId}" into source code.`);
    //compileContext.logger.debug('AST:\n' + JSON.stringify(compileContext.astMap[topoId], null, 2));
}

function getCodeRepresentationOf(topoId, compileContext) {
    let lastSourceType = compileContext.sourceMap.get(topoId);

    if (lastSourceType && lastSourceType.type === AST_BLK_MODIFIER_CALL) {
        //for modifier, just use the final result
        return JsLang.astVarRef(lastSourceType.target);
    }

    return compileContext.astMap[topoId];
}

function createCompileContext(targetName, dbServiceId, logger, sharedContext) {
    let compileContext = {
        targetName,
        dbServiceId,
        logger,
        topoNodes: new Set(),
        topoSort: Util.createTopoSort(),
        astMap: {}, // Store the AST for a node
        sourceMap: new Map(), // Store the source code block point
        modelVars: new Set(),
        mapOfFunctorToFile: (sharedContext && sharedContext.mapOfFunctorToFile) || {},
        newFunctorFiles: (sharedContext && sharedContext.newFunctorFiles) || []
    };

    compileContext.mainStartId = createTopoId(compileContext, '$main');

    logger.verbose(`Created compilation context for target "${targetName}" with db service "${dbServiceId}".`);

    return compileContext;
}

module.exports = {
    compileParam,
    compileField,
    compileDbOperation,
    compileExceptionalReturn,
    compileReturn,
    createTopoId,
    createCompileContext,
    dependsOn,
    addCodeBlock,

    AST_BLK_FIELD_PRE_PROCESS,
    AST_BLK_MODIFIER_CALL,
    AST_BLK_VALIDATOR_CALL,
    AST_BLK_COMPOSOR_CALL,
    AST_BLK_VIEW_OPERATION,
    AST_BLK_VIEW_RETURN,
    AST_BLK_INTERFACE_OPERATION,
    AST_BLK_INTERFACE_RETURN, 
    AST_BLK_EXCEPTION_ITEM,

    OOL_FUNCTOR_MAP,
    OOL_FUNCTOR_RETURN
};
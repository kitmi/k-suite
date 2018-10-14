"use strict";

const Util = require('../../util.js');
const _ = Util._;

const Entity = require('./entity.js');
const Schema = require('./schema.js');
const Field = require('./field.js');

const deepClone = (value, stack) => {
    if (typeof value !== 'object') {
        return value;
    }

    if (stack && stack.has(value)) {
        return stack.get(value);
    } 

    let result;

    if (_.isArray(value)) {
        result = [];
        stack && stack.set(value, result);
        value.forEach(v => { result.push(deepClone(v, stack)); });
    } else if (_.isPlainObject(value)) {
        result = {};
        stack && stack.set(value, result);
        _.each(value, (v, k) => { result[k] = deepClone(v, stack); });
    } else {
        if ((value instanceof Entity.constructor) ||
            (value instanceof Schema.constructor) ||
            (value instanceof Field.constructor)
        ) {
            result = value.clone(stack);
            stack && stack.set(value, result);
        } else {
            result = _.clone(value);
            stack && stack.set(value, result);
        }
    }

    return result;
};

const deepCloneField = (src, dest, field, stack) => {
    if (src[field]) dest[field] = deepClone(src[field], stack);
};

const isMemberAccess = (name) => (name.indexOf('.') > 0);

const extractMemberAccess = (name) => name.split('.');

const getReferenceNameIfItIs = (obj) => {
    if (_.isPlainObject(obj) && obj.oolType === 'ObjectReference') {
        return extractMemberAccess(obj.name)[0];
    }

    return undefined;
};

exports.parseReferenceInDocument = (schema, doc, ref) => {    
    let parts = ref.split('.');
    let parent;
    let l = parts.length;
    let entityNode, entity, field;
    
    for (let i = 0; i < l; i++) {
        let p = parts[i];
        
        if (!entityNode) {
            if (doc.entity === p) {
                entityNode = doc;
                continue;
            }

            throw new Error(`Reference by path "${ref}" not found in given document.`);
        }

        if (entityNode && p[0] === '$') {
            entity = schema.entities[entityNode.entity];
            let attr = entity.getEntityAttribute(p);

            if (attr instanceof Field) {
                field = attr;
                if (i !== l-1) {
                    throw new Error(`Reference by path "${ref}" not found in given document.`);
                }

                return {
                    entityNode,
                    entity,
                    field
                };
            } else {
                parent = attr;
            }

            continue;
        }
        
        if (parent) {
            parent = parent[p];
        } else {
            if (i === l-1) {
                //last part
                entity = schema.entities[entityNode.entity];
                field = entity.getEntityAttribute(p);

                return {
                    entityNode,
                    entity,
                    field
                };
            }

            entityNode = entityNode.subDocuments && entityNode.subDocuments[p];
            if (!entityNode) {
                throw new Error(`Reference by path "${ref}" not found in given document.`);
            }
        }
    }

    if (!field) {
        if (typeof parent !== 'string') {
            throw new Error(`Reference by path "${ref}" not found in given document.`);
        }

        if (!entity) {
            throw new Error(`Reference by path "${ref}" not found in given document.`);
        }

        field = entity.getEntityAttribute(parent);
        if (!(field instanceof Field)) {
            throw new Error(`Reference by path "${ref}" not found in given document.`);
        }
    }
    
    return {
        entityNode,
        entity,
        field
    };
};

exports.deepClone = deepClone;
exports.deepCloneField = deepCloneField;
exports.isMemberAccess = isMemberAccess;
exports.extractMemberAccess = extractMemberAccess;
exports.getReferenceNameIfItIs = getReferenceNameIfItIs;
exports.entityNaming = name => _.camelCase(name);
exports.fieldNaming = name => _.camelCase(name);

const Features = require('../runtime/features');

exports.applyFeature = (ruleName, meta, context, db) => {
    _.forOwn(meta.features, (featureSettings, name) => {
        _.castArray(featureSettings).forEach(featureSetting => {
            let rules = Features[name + '.' + ruleName];
            if (rules) {
                _.find(rules, rule => rule.test(meta, featureSetting, context, db) && !rule.apply(meta, featureSetting, context, db));
            }
        });        
    });       
};

exports.FUNCTOR_VALIDATOR = 'validator';
exports.FUNCTOR_MODIFIER = 'modifier';
exports.FUNCTOR_COMPOSER = 'composer';
exports.FUNCTORS_LIST = [ 'computedBy', 'validators0', 'modifiers0', 'validators1', 'modifiers1' ];

exports.RULE_POST_RAW_DATA_PRE_PROCESS = 'postRawDataPreProcess';
exports.RULE_POST_CREATE_CHECK = 'postCreateCheck';
exports.RULE_POST_UPDATE_CHECK = 'postUpdateCheck';
exports.RULE_BEFORE_CREATED_RETRIEVE = 'beforeCreatedRetrieve';
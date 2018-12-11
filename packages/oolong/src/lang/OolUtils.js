"use strict";

const { _ } = require('rk-utils');

//const Entity = require('./Entity');
//const Schema = require('./schema.js');
//const Field = require('./field.js');

class Clonable {
    linked = false;

    clone() {      
        assert: this.linked, 'An element becomes clonable only after being linked.';
    }
}

const deepClone = (value) => _.cloneDeepWith(value, el => (el instanceof Clonable) ? el.clone() : undefined);

const deepCloneField = (src, dest, field) => {
    if (field in src) dest[field] = deepClone(src[field]);
};

const isDotSeparateName = (name) => (name.indexOf('.') > 0);

const extractDotSeparateName = (name) => name.split('.');

const extractReferenceBaseName = (name) => extractDotSeparateName(name).pop();

const getReferenceNameIfItIs = (obj) => {
    if (_.isPlainObject(obj) && obj.oolType === 'ObjectReference') {
        return extractDotSeparateName(obj.name)[0];
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
exports.isDotSeparateName = isDotSeparateName;
exports.extractDotSeparateName = extractDotSeparateName;
exports.extractReferenceBaseName = extractReferenceBaseName;
exports.getReferenceNameIfItIs = getReferenceNameIfItIs;
exports.schemaNaming = name => _.camelCase(name);
exports.entityNaming = name => _.camelCase(name);
exports.fieldNaming = name => _.camelCase(name);
exports.generateDisplayName = name => _.startCase(name);
exports.formatFields = field => Array.isArray(field) ? field.join(', ') : field;
exports.Clonable = Clonable;
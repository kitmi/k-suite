"use strict";

const Util = require('rk-utils');
const _ = Util._;
const Types = require('../../runtime/types');
const FEATURE_NAME = 'autoId';

/**
 * A rule specifies the id of entity is automatically generated.
 * @module EntityFeature_AutoId
 */


/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {array} options - Auto id field options
 * @property {string} [options.name='id'] - Field name
 * @property {string} [options.type='int'] - Field type
 */
function initialize(entity, args = []) {
    let typeInfo = {
        name: 'id',
        type: 'integer',
        auto: true,
        readOnly: true,
        writeOnce: true
    };

    let [ options ] = args;

    if (options) {
        if (typeof options === 'string') {
            options = { name: options };
        }

        Object.assign(typeInfo, options);
    }

    let fieldName = typeInfo.name;

    entity.addFeature(FEATURE_NAME, {
        field: fieldName        
    }).on('beforeAddingFields', () => {
        entity.addField(fieldName, typeInfo)
            .setKey(fieldName);
    });
}

module.exports = initialize;
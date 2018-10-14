"use strict";

const Util = require('../../../util.js');
const _ = Util._;
const OolUtil = require('../ool-utils.js');
const FEATURE_NAME = 'autoId';

/**
 * @module OolongEntityFeature_AutoId
 * @summary A rule specifies the id of entity is automatically generated
 */


/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {array} options - Auto id field options
 * @property {string} [options.name='id'] - Field name
 * @property {string} [options.type='int'] - Field type
 */
function initialize(entity, options) {
    let typeInfo = {
        name: 'id',
        type: 'int',
        auto: true,
        readOnly: true,
        fixedValue: true
    };

    if (options) {
        if (typeof options === 'string') {
            options = { name: options };
        }

        Object.assign(typeInfo, options);
    }

    let fieldName = typeInfo.name;
    delete typeInfo.name;

    entity.addFeature(FEATURE_NAME, {
        field: fieldName        
    }).on('beforeFields', () => {
        entity.addField(fieldName, typeInfo)
            .setKey(fieldName);
    });
}

module.exports = initialize;
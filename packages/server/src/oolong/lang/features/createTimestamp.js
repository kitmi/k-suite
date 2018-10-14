"use strict";

const Util = require('../../../util.js');
const _ = Util._;
const FEATURE_NAME = 'createTimestamp';

/**
 * @module OolongEntityFeature_CreateTimestamp
 * @summary A rule specifies the entity to automatically record the creation time
 */

/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {array} options - Field options
 */
function initialize(entity, options) {
    let typeInfo = {
        name: 'createdAt',
        type: 'datetime',
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
    }).on('afterFields', () => {
        entity.addField(fieldName, typeInfo);
    });
}

module.exports = initialize;
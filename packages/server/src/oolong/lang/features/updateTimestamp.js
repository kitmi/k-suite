"use strict";

const Util = require('../../../util.js');
const _ = Util._;
const FEATURE_NAME = 'updateTimestamp';

/**
 * @module OolongEntityFeature_UpdateTimestamp
 * @summary A rule specifies the change of state will be tracked automatically
 */

/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {object} options - Field options
 */
function initialize(entity, options) {
    let typeInfo = {
        name: 'updatedAt',
        type: 'datetime',
        readOnly: true,
        forceUpdate: true,
        optional: true
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
        entity.addField(fieldName, typeInfo)
    });
}

module.exports = initialize;
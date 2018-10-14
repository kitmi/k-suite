"use strict";

const Util = require('../../../util.js');
const _ = Util._;
const FEATURE_NAME = 'logicalDeletion';

/**
 * @module OolongEntityFeature_LogicalDeletion
 * @summary A rule specifies the entity will not be deleted physically
 */

/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {object} options - Field options, can be a string as a new status field or an object reference to a certain status of an existing field
 */
function initialize(entity, options) {
    let newField = true, fieldInfo = {
        name: 'isDeleted',
        type: 'bool',
        'default': false,
        readOnly: true
    }, fieldName, featureSetting;

    if (options) {
        if (_.isPlainObject(options)) {
            newField = false;

            let keys = Object.keys(options);
            if (keys.length !== 1) {
                throw new Error(`Invalid options for feature "${FEATURE_NAME}".`);
            }

            let fieldName = keys[0];

            featureSetting = {
                field: fieldName,
                value: options[fieldName]
            };

        } else if (typeof options === 'string') {
            Object.assign(fieldInfo, { name: options });
        } else {
            throw new Error(`Invalid options for feature "${FEATURE_NAME}".`);
        }
    }

    if (newField) {
        fieldName = fieldInfo.name;
        delete fieldInfo.name;

        entity.addFeature(FEATURE_NAME, {
            field: fieldName,
            value: true
        });

        entity.on('afterFields', () => {
            entity.addField(fieldName, fieldInfo)
        });
    } else {
        entity.addFeature(FEATURE_NAME, featureSetting);

        entity.on('afterFields', () => {
            if (!entity.hasField(featureSetting.field)) {
                throw new Error(`Field "${featureSetting.field}" used by feature "${FEATURE_NAME}" is not found in entity "${entity.name}".`);
            }
        });
    }
}

module.exports = initialize;
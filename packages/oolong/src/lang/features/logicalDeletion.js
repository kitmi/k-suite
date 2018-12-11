"use strict";

const Util = require('rk-utils');
const _ = Util._;

const Rules = require('../Rules');

const FEATURE_NAME = 'logicalDeletion';

/**
 * A rule specifies the entity will not be deleted physically.
 * @module EntityFeature_LogicalDeletion
 */

/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {object} options - Field options, can be a string as a new status field or an object reference to a certain status of an existing field
 */
function feature(entity, args = []) {
    let newField = true, fieldInfo = {
        name: 'isDeleted',
        type: 'boolean',
        'default': false,
        readOnly: true
    }, fieldName, featureSetting;

    let [ options ] = args;

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

        entity.on('afterAddingFields', () => {
            entity.addField(fieldName, fieldInfo)
        });
    } else {
        entity.addFeature(FEATURE_NAME, featureSetting);

        entity.on('afterAddingFields', () => {
            if (!entity.hasField(featureSetting.field)) {
                throw new Error(`Field "${featureSetting.field}" used by feature "${FEATURE_NAME}" is not found in entity "${entity.name}".`);
            }
        });
    }
}

feature.__metaRules = {
    [Rules.RULE_BEFORE_FIND]: ({ feature, entityModel, context }, next) => {
        let findOptions = context.findOptions;
        if (!findOptions.$includeDeleted) {
            findOptions.$where = entityModel.mergeCondition(findOptions.$where, { [feature.field]: { $ne: feature.value } });
        }

        return next();
    }
};

module.exports = feature;
"use strict";

const Util = require('rk-utils');
const { _ } = Util;
const { DataValidationError } = require('../../runtime/Errors');
const Features = require('../../runtime/Features');

const FEATURE_NAME = 'atLeastOneNotNull';

/**
 * A rule specifies at least one field not null, e.g. email or mobile.
 * @module EntityFeature_AtLeastOneNotNull
 */

/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {array} fields - List of field names
 */
function feature(entity, fields) {
    if (!fields) {
        throw new Error('Missing field names!');
    }

    Array.isArray(fields) || (fields = [ fields ]);

    entity.addFeature(FEATURE_NAME, fields, true).on('afterAddingFields', () => {
        fields.forEach(fieldName => {
            let field = entity.fields[fieldName];

            if (!field) {
                throw new Error('Required field "' + fieldName + '" not exist.');
            }

            field.optional = true;
        });
    });
}

feature.__metaRules = {
    [Features.RULE_POST_CREATE_CHECK]: ({ feature, entityMeta, context }, next) => {
        if (_.every(feature, fieldName => _.isNil(context.latest[fieldName]))) {
            throw new DataValidationError(`At least one of these fields ${ featureSetting.map(f => Util.quote(f)).join(', ') } should not be null.`, {
                entity: entityMeta.name,
                fields: featureSetting
            });
        }

        return next();
    },
    [Features.RULE_POST_UPDATE_CHECK]: ({ feature, entityMeta, context }, next) => {
        if (_.every(feature, fieldName => ((fieldName in context.latest) && _.isNil(context.latest[fieldName])) || (!(fieldName in context.latest) && _.isNil(context.existing[fieldName])))) {
            throw new DataValidationError(`At least one of these fields ${ featureSetting.map(f => Util.quote(f)).join(', ') } should not be null.`, {
                entity: entityMeta.name,
                fields: featureSetting
            });
        }

        return next();
    }
};

module.exports = feature;
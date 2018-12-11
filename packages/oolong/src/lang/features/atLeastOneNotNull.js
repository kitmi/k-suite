"use strict";

const Util = require('rk-utils');
const { _ } = Util;
const { DataValidationError } = require('../../runtime/Errors');
const Rules = require('../Rules');

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
function feature(entity, [ fields ]) {
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
    [Rules.RULE_BEFORE_CREATE]: ({ feature, entityModel, context }, next) => {
        _.each(feature, item => {
            if (_.every(item, fieldName => _.isNil(context.latest[fieldName]))) {
                throw new DataValidationError(`At least one of these fields ${ item.map(f => Util.quote(f)).join(', ') } should not be null.`, {
                    entity: entityModel.meta.name,
                    fields: feature
                });
            }
        });  

        return next();
    },
    [Rules.RULE_BEFORE_UPDATE]: ({ feature, entityModel, context }, next) => {
        _.each(feature, item => {
            if (_.every(item, fieldName => context.latest.hasOwnProperty(fieldName) ? 
                _.isNil(context.latest[fieldName]) : 
                (context.existing && _.isNil(context.existing[fieldName])))
            ) {
                throw new DataValidationError(`At least one of these fields ${ item.map(f => Util.quote(f)).join(', ') } should not be null.`, {
                    entity: entityModel.meta.name,
                    fields: feature
                });
            }
        });  

        return next();
    }
};

module.exports = feature;
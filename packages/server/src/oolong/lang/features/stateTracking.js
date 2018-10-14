"use strict";

const Util = require('../../../util.js');
const _ = Util._;
const OolUtil = require('../ool-utils.js');
const { Generators } = require('../../runtime');

const FEATURE_NAME = 'stateTracking';

/**
 * @module OolongEntityFeature_StateTracking
 * @summary A rule specifies the change of state will be tracked automatically
 */

/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {object} options - Tracking field options
 * @property {string} options.field - State field to track
 * @property {bool} [options.reversible=false] - Specify whether the field can be set to a previous state again
 */
function feature(entity, options) {
    if (!options) {
        throw new Error('Missing field options!');
    }

    if (typeof options === 'string') {
        options = { field: options };
    }

    if (!options.field) {
        throw new Error('Missing field name in options!');
    }

    let stateSetTimestamp = {
        type: 'datetime',
        range: 'timestamp',
        readOnly: true,
        optional: true,
        auto: true
    };

    if (!options.reversible) {
        stateSetTimestamp.fixedValue = true;
    }

    entity.addFeature(FEATURE_NAME, {
        field: options.field
    }, true).on('afterFields', () => {
        if (!entity.hasField(options.field)) {
            throw new Error('Field "' + options.field + '" does not exist!');
        }

        let fieldInfo = entity.fields[options.field];

        if (fieldInfo.type !== 'enum') {
            throw new Error('Only enum field can be used with stateTracking feature!');
        }

        fieldInfo.values.forEach(state => {
            let fieldName = options.field + _.upperFirst(_.camelCase(state)) + 'Timestamp';

            entity.addField(fieldName, stateSetTimestamp);
        });
    });
}

feature.__metaRules = {
    [OolUtil.RULE_POST_RAW_DATA_PRE_PROCESS]: [{
        test: (meta, feature, context, db) => {
            return feature.field in context.latest;
        },
        apply: (meta, feature, context, db) => {
            let targetState = context.latest[feature.field];
            let timestampFieldName = feature.field + Util.pascalCase(targetState) + 'Timestamp';
            context.latest[timestampFieldName] = Generators.$auto(meta.fields[timestampFieldName], (db.ctx && db.ctx.__) || db.appModule.__);
            return true;
        }
    }]
};

module.exports = feature;
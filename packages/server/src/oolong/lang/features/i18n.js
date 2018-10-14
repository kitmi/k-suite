"use strict";

const Util = require('../../../util.js');
const _ = Util._;
const FEATURE_NAME = 'i18n';

/**
 * @module OolongEntityFeature_I18n
 * @summary A rule specifies internationalization
 */

/**
 * Initialize the feature
 * @param {OolongEntity} entity - Entity to apply this feature
 * @param {object} options - Tracking field options
 * @property {string} options.field - State field to apply this feature
 * @property {object} [options.locales] - Specify the locale mapping rule
 */
function initialize(entity, options) {
    if (!options) {
        throw new Error('Missing feature options!');
    }

    if (!_.isPlainObject(options)) {
        throw new Error('Invalid feature options. Plain object expected!');
    }

    if (!options.field) {
        throw new Error('Missing field name in options!');
    }

    if (!options.locales) {
        throw new Error('Missing locale mapping in options!');
    }

    if (!_.isPlainObject(options.locales)) {
        throw new Error('Invalid locale mapping. Plain object expected!');
    }

    entity.addFeature(FEATURE_NAME, options, true).on('afterFields', () => {
        if (!entity.hasField(options.field)) {
            throw new Error('Field "' + options.field + '" does not exist!');
        }

        let fieldInfo = entity.fields[options.field];
        let suffixSet = new Set(Object.values(options.locales));

        for (let suffix of suffixSet) {
            if (suffix === 'default') continue;

            let fieldName = options.field + '_' + suffix;
            entity.addField(fieldName, fieldInfo);
        }
    });

}

module.exports = initialize;
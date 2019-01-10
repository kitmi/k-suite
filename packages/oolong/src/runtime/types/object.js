"use strict";

const _ = require('rk-utils')._;
const { isNothing } = require('../../utils/lang');
const any = require('./any');

module.exports = {
    name: 'object',

    alias: [ 'json' ],

    sanitize: (value, info, i18n) => {
        if (_.isPlainObject(value)) return value;

        if (_.isObjectLike(value)) return _.toPlainObject(value);

        if (typeof value === 'string') {
            let trimmed = value.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                return JSON.parse(trimmed);
            }                   
        }

        throw new TypeError(`Invalid object: ${value}`);
    },

    defaultValue: {},

    generate: (info, i18n) => null,

    serialize: (value) => isNothing(value) ? null : JOSN.stringify(value),

    qualifiers: any.qualifiers.concat([
    ])
};
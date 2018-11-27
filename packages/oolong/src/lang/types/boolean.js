"use strict";

const validator = require('validator');
const any = require('./any');

module.exports = {
    name: 'boolean',

    alias: [ 'bool' ],

    sanitize: (value, info, i18n) => typeof value === 'boolean' ? value : validator.toBoolean(value, true),

    defaultValue: false,

    generate: (info, i18n) => false,

    serialize: value => value,

    qualifiers: any.qualifiers.concat([
    ])
};
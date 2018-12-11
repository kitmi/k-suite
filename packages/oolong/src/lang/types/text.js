"use strict";

const randomstring = require("randomstring");
const any = require('./any');

module.exports = {
    name: 'text',

    alias: [ 'string', 'char' ],

    sanitize: (value, info, i18n) => (typeof value !== 'string' ? value.toString() : value).trim(),

    defaultValue: '',

    generate: (info, i18n) => info.fixedLength ? randomstring.generate(info.fixedLength) : randomstring.generate(info.maxLength < 32 ? info.maxLength : 32),

    serialize: value => value,

    qualifiers: any.qualifiers.concat([
        'fixedLength',
        'maxLength',
        'encoding'
    ])
};
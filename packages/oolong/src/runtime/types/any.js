"use strict";

const { List } = require('immutable');

module.exports = {
    qualifiers: List([
        'code',
        'optional',
        'default',
        'auto',
        'readOnly',
        'writeOnce',
        'forceUpdate'
    ])
};
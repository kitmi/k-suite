"use strict";

const uniqid = require('uniqid');

module.exports = function (info, i18n, options) {
    pre: info.type === 'text', '"uid" should be a text field.';

    return uniqid();
}
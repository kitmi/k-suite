"use strict";

const { tryRequire } = require('@k-suite/app/lib/utils/Helpers');

module.exports = function (info, i18n, options) {
    pre: info.type === 'text', '"uid" should be a text field.';

    const uniqid = tryRequire('uniqid');

    return uniqid();
}
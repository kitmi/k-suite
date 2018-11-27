"use strict";

const { tryRequire } = require('@k-suite/app/lib/utils/Helpers');

module.exports = function (info, i18n, options) {
    pre: info.type === 'text', '"uuid" should be a text field.';    

    const uuidv4 = tryRequire('uuid/v4');
    
    return uuidv4();
}
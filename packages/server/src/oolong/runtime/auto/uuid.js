"use strict";

const uuidv4 = require('uuid/v4');

module.exports = function (info, i18n, options) {
    pre: info.type === 'text', '"uuid" should be a text field.';    
    
    return uuidv4();
}
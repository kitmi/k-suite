"use strict";

const hyperid = require('hyperid');

let flInstance, instance;

module.exports = function (info, i18n, options) {
    pre: info.type === 'text', '"uuid" should be a text field.';

    if (info.fixedLength) {
        if (!flInstance) {
            flInstance = hyperid({fixedLength: true});
        }
        
        return flInstance();
    }
    
    if (!instance) {
        instance = hyperid();
    }
    
    return instance();
}
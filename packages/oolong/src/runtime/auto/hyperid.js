"use strict";

const { tryRequire } = require('@k-suite/app/lib/utils/Helpers');

let flInstance, instance;

module.exports = function (info, i18n, options) {
    pre: info.type === 'text', '"uuid" should be a text field.';

    const hyperid = tryRequire('hyperid');

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
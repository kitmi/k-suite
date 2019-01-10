"use strict";

const Types = require('./types'); 
const Errors = require('./Errors');
const Convertors = require('./Convertors');
const Processors = require('./Processors');
const Validators = require('./Validators');
const Generators = require('./Generators');
const Connector = require('./Connector');

module.exports = { 
    Types, Errors, Convertors, Processors, Validators, Generators, Connector,

    sanitize: function (value, info, i18n) {
        pre: {
            Types.Builtin.has(info.type), `Unknown primitive type: "${info.type}"."`;
        }
    
        let typeObjerct = Types[info.type];
        return typeObjerct.sanitize(value, info, i18n);
    }
};
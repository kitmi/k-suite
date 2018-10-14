"use strict";

const randomstring = require("randomstring");
const path = require('path');
const Util = require('rk-utils');
const Types = require('./Types');

const basePath = path.resolve(__dirname, 'auto');

let generators = Util.fs.readdirSync(basePath);
let G = {};

generators.forEach(file => {
    let f = path.join(basePath, file);
    if (Util.fs.statSync(f).isFile() && Util._.endsWith(file, '.js')) {
        let g = path.basename(file, '.js');
        G[g] = require(f);
    }
});

function auto(info, i18n) {
    pre: info.auto, `Not an automatically generated field "${ info.name }".`;

    if (info.generator) {
        let name, options;

        //customized generator
        if (typeof info.generator === 'string') {
            name = info.generator;
        } else {
            name = info.generator.name;
            options = info.generator.options;
        }

        let gtor = exports[name];
        return gtor(info, i18n, options);
    } else {
        //'int', 'float', 'decimal', 'text', 'bool', 'binary', 'datetime', 'json', 'xml', 'enum', 'csv'

        switch (info.type) {
            case Types.TYPE_INT:
            case Types.TYPE_FLOAT:
            case Types.TYPE_DECIMAL:
            return 0;

            case Types.TYPE_TEXT:
            if (info.fixedLength) {
                return randomstring.generate(info.fixedLength);
            }

            if (info.maxLength < 32) {
                return randomstring.generate(info.maxLength);
            }

            return "";

            case Types.TYPE_BOOL:
            return false;

            case Types.TYPE_BINARY:
            return "";

            case Types.TYPE_DATETIME:
            return (i18n && i18n.datetime().toDate()) || Util.moment().toDate();

            case Types.TYPE_JSON:
            case Types.TYPE_XML:
            case Types.TYPE_CSV:
            return "";

            case Types.TYPE_ENUM:
            return info.values ? info.values[0] : null;
        }
    }
};

Object.assign(exports, G);
exports.$auto = auto;
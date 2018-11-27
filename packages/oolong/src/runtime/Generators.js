"use strict";


const path = require('path');
const Util = require('rk-utils');
const { Builtin } = require('../lang/types');

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
    pre: {
        Builtin.has(info.type), `Unknown primitive type: "${info.type}"."`;
        info.auto, `Not an automatically generated field "${ info.name }".`;
    }

    if (info.generator) {
        let name, options;

        //customized generator
        if (typeof info.generator === 'string') {
            name = info.generator;
        } else {
            name = info.generator.name;
            options = info.generator.options;
        }

        let gtor = G[name];
        return gtor(info, i18n, options);
    } 

    let typeObjerct = Types[info.type];
    return typeObjerct.generate(info, i18n);
};

Object.assign(exports, G);
exports.$auto = auto;
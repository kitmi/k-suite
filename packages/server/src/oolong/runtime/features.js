"use strict";

const path = require('path');
const Util = require('../../util');

const basePath = path.resolve(__dirname, '..', 'lang', 'features');
let features = Util.fs.readdirSync(basePath);

let Features = {};

features.forEach(file => {
    let f = path.join(basePath, file);
    if (Util.fs.statSync(f).isFile() && Util._.endsWith(file, '.js')) {
        let g = path.basename(file, '.js');
        let feature = require(f);

        if (feature.__metaRules) {
            Util._.forOwn(feature.__metaRules, (rules, scenario) => {
                Features[g+'.'+scenario] = rules;
            })            
        }
    }
});

module.exports = Features;
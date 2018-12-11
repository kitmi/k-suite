"use strict";

const path = require('path');
const { _, fs, eachAsync_ } = require('rk-utils');
const { HashRules } = require('@k-suite/rules-engine');
const Rules = require('../lang/Rules');

const basePath = path.resolve(__dirname, '..', 'lang', 'features');
const features = fs.readdirSync(basePath);

const featureRules = new HashRules();

features.forEach(file => {
    let f = path.join(basePath, file);
    if (fs.statSync(f).isFile() && _.endsWith(file, '.js')) {
        let g = path.basename(file, '.js');
        let feature = require(f);

        if (feature.__metaRules) {
            _.forOwn(feature.__metaRules, (actions, ruleName) => {
                
                featureRules.addRule(g+'.'+ruleName, actions);
            })            
        }
    }
});

module.exports = {
    applyRules_: async (ruleName, entityModel, context) => 
        eachAsync_(entityModel.meta.features, (feature, name) => featureRules.run_(name + '.' + ruleName, { feature, entityModel, context })),
    ...Rules
};
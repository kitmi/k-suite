"use strict";

const path = require('path');
const { _, fs, eachAsync_ } = require('rk-utils');
const { HashRules } = require('@k-suite/rules-engine');

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
    applyRules_: async (ruleName, entityMeta, context) => 
        eachAsync_(entityMeta.features, (feature) => featureRules.run_(feature.name + '.' + ruleName, { feature: feature.args, entityMeta, context })),

    RULE_POST_DATA_VALIDATION: 'postDataValidation',
    RULE_POST_CREATE_CHECK: 'postCreateCheck',
    RULE_POST_UPDATE_CHECK: 'postUpdateCheck',
    RULE_BEFORE_CREATED_RETRIEVE: 'beforeCreatedRetrieve'
};
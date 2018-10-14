"use strict";

const _ = require('rk-utils')._;
const { InvalidConfiguration } = require('../Errors');

exports.requireFeatures = function (features, app, middleware) {
    let hasNotEnabled = _.find(_.castArray(features), feature => !app.enabled(feature));

    if (hasNotEnabled) {
        throw new InvalidConfiguration(
            `"${middleware}" requires "${hasNotEnabled}" feature to be enabled.`,
            app,
            `middlewares.${middleware}`
        );
    }
}
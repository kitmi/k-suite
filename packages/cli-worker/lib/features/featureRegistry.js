"use strict";

const Feature = require('../enum/Feature');

const Util = require('rk-utils');

module.exports = {
  type: Feature.CONF,
  load_: (app, registry) => {
    let orgininalLoader = app.loadFeature;

    app.loadFeature = feature => {
      if (registry.hasOwnProperty(feature)) {
        let loadOption = registry[feature];
        let featureObject;

        if (Array.isArray(loadOption)) {
          if (loadOption.length === 0) {
            throw new Error(`Invalid registry value for feature "${feature}".`);
          }

          featureObject = require(loadOption[0]);

          if (loadOption.length > 1) {
            featureObject = Util.getValueByPath(featureObject, loadOption[1]);
          }
        } else {
          featureObject = require(loadOption);
        }

        if (!Feature.validate(featureObject)) {
          throw new Error(`Invalid feature object loaded from "${feature}".`);
        }

        return featureObject;
      }

      return orgininalLoader.bind(app)(feature);
    };
  }
};
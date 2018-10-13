"use strict";

const Feature = require('../enum/Feature');

module.exports = {
  type: Feature.CONF,
  load_: (app, registry) => {
    app.addFeatureRegistry(registry);
  }
};
"use strict";

const Feature = require('../enum/Feature');

module.exports = {
  type: Feature.INIT,
  load_: function (app, settings) {
    app.settings = Object.assign({}, settings);
  }
};
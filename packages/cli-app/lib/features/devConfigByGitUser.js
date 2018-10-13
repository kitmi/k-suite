"use strict";

const path = require('path');

const Feature = require('../enum/Feature');

const Util = require('rk-utils');

const JsConfigProvider = require('rk-config/lib/JsConfigProvider');

module.exports = {
  type: Feature.CONF,
  load_: async (app, options) => {
    let devName = options.altUserForTest || Util.runCmdSync('git config --global user.name').trim();

    if (devName === '') {
      throw new Error('Unable to read "user.name" of git config.');
    }

    app.configLoader.provider = new JsConfigProvider(path.join(app.configPath, app.configName, devName));
    app.config = await app.configLoader.load_();
  }
};
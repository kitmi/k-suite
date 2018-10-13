"use strict";

const winston = require('winston');

const winstonFlight = require('winstonflight');

const Feature = require('../enum/Feature');

const Util = require('rk-utils');

module.exports = {
  type: Feature.SERVICE,
  load_: function (app, categories) {
    let loggers = new winston.Container();

    Util._.forOwn(categories, (loggerConfig, name) => {
      if (loggerConfig.transports) {
        loggerConfig.transports = winstonFlight(winston, loggerConfig.transports);
      }

      let logger = loggers.add(name, loggerConfig);
      app.registerService('logger:' + name, logger);
    });

    app.registerService('loggers', loggers);
    app.on('stopping', () => {
      loggers.close();
    });
  }
};
"use strict";

/**
 * Enable multi-categories logging by winston logger
 * @module Feature_Loggers
 */

const winston = require('winston');
const winstonFlight = require('winstonflight');
const Feature = require('../enum/Feature');
const Util = require('rk-utils');

/*

 loggers: {
     'category1': {
         "transports": [
            {
                "type": "console",
                "options": {                            
                    "format": winston.format.combine(winston.format.colorize(), winston.format.simple())
                }
            },
            {
                "type": "file",
                "options": {
                    "level": "info",
                    "filename": `${name || 'app'}.log`
                }
            }
        ]
     },
     'category2': {
         transports: [
             {
                "type": "daily-rotate-file",
                "options": {
                    "level": "info",
                    "filename": "category2-%DATE%.log",
                    "datePattern": "YYYYMMDD"
                }
            }
         ]
     }
 }

 */

module.exports = {

    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.SERVICE,

    /**
     * Load the feature
     * @param {CliApp} app - The cli app module object
     * @param {object} categories - Configuration for multi-categories
     * @returns {Promise.<*>}
     * @example
     *  let loggers = app.getService('loggers');
     *  let logger = loggers.get('category');
     *  logger.log('info', 'information');
     *  logger.log('warn', 'warning');
     *
     *  let logger = app.getService('logger:category1');
     *  logger.log('error', 'error');
     */
    load_: function (app, categories) {
        let loggers = new (winston.Container)();

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
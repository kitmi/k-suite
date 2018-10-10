"use strict";

/**
 * @module Feature_DevConfigByGitUser
 * @summary Enable developer specific config identified by git user name
 */

const path = require('path');
const Feature = require('../enum/Feature');
const Literal = require('../enum/Literal');
const Util = require('rk-utils');

const JsConfigProvider = require('rk-config/lib/JsConfigProvider');

module.exports = {

    /**
     * This feature is loaded at configuration stage
     * @member {string}
     */
    type: Feature.CONF,

    /**
     * Load the feature
     * @param {CliApp} app - The cli app module object
     * @param {object} options - Options for the feature     
     * @param {string} [options.altUserForTest] - Alternative username for test purpose, if given, this feature will not get git user but use this given value instead
     * @returns {Promise.<*>}
     */
    load_: async (app, options) => {
        let devName = options.altUserForTest || Util.runCmdSync('git config --global user.name').trim();
        if (devName === '') {
            throw new Error('Unable to read "user.name" of git config.');
        }            

        app.configLoader.provider = new JsConfigProvider(path.join(app.configPath, Literal.APP_CFG_NAME, devName));
        app.config = await app.configLoader.load_();
    }
};
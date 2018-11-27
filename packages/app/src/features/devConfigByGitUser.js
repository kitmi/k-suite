"use strict";

/**
 * Enable developer specific config identified by git user name.
 * @module Feature_DevConfigByGitUser
 */

const path = require('path');
const Feature = require('../enum/Feature');
const Util = require('rk-utils');

const JsonConfigProvider = require('rk-config/lib/JsonConfigProvider');

module.exports = {

    /**
     * This feature is loaded at configuration stage
     * @member {string}
     */
    type: Feature.CONF,

    /**
     * Load the feature
     * @param {App} app - The cli app module object
     * @param {object} options - Options for the feature     
     * @param {string} [options.altUserForTest] - Alternative username for test purpose, if given, this feature will not get git user but use this given value instead
     * @returns {Promise.<*>}
     */
    load_: async (app, options) => {
        let devName = options.altUserForTest || Util.runCmdSync('git config --global user.name').trim();
        if (devName === '') {
            throw new Error('Unable to read "user.name" of git config.');
        }            

        app.configLoader.provider = new JsonConfigProvider(path.join(app.configPath, app.configName, devName));
        return app.loadConfig_();
    }
};
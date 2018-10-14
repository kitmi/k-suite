"use strict";

/**
 * @module Feature_Passport
 * @summary Enable passport feature
 */

const path = require('path');
const Mowa = require('../server.js');
const Feature = require('../enum/feature');
const Util = Mowa.Util;
const Promise = Util.Promise;

const KoaPassport = require('koa-passport').KoaPassport;

module.exports = {

    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.SERVICE,

    /**
     * Load the feature
     * @param {AppModule} appModule - The app module object
     * @param {object} config - Passport settings
     * @property {object} config.localAuth - Passport local config          
     * @property {string} config.localAuth.store - Storage for localAuth info, url or session
     * @property {string} config.localAuth.loginUrl - The url of login page
     * @property {string} config.localAuth.redirectToUrlFieldName - The field name of redirect url used in session or url
     * @property {string} config.localAuth.defaultLandingPage - Default landing page when logging in without redirect url
     * @property {array} config.strategies - Passport strategies, e.g. [ 'local', 'facebook' ]
     * @returns {Promise.<*>}
     */
    load_: function (appModule, config) {
        if (appModule.serverModule.options.cliMode) return Promise.resolve();

        let passport = new KoaPassport();
        if (Util._.isEmpty(config) || !config.strategies) {
            throw new Mowa.Error.InvalidConfiguration(
                'Missing passport strategies.',
                appModule,
                'passport.strategies'
            );
        }        

        passport.config = config;
        passport.config.localAuth = Object.assign(
            { store: 'session', loginUrl: '/login', redirectToUrlFieldName: 'redirectToUrl' }, 
            passport.config.localAuth
        );

        appModule.registerService('passport', passport);

        let strategies = Array.isArray(config.strategies) ? config.strategies : [ config.strategies ];

        return Util.eachAsync_(strategies, async strategy => {
            let strategyScript = path.join(appModule.backendPath, 'passports', strategy + '.js');
            let strategyInitiator = require(strategyScript);
            return strategyInitiator(appModule, passport);
        });
    }
};
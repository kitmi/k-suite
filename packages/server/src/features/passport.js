"use strict";

/**
 * Enable passport feature
 * @module Feature_Passport
 */

const path = require('path');
const { _, eachAsync_ } = require('rk-utils');
const { Feature } = require('..').enum;
const { tryRequire } = require('@k-suite/app/lib/utils/Helpers');
const KoaPassport = tryRequire('koa-passport').KoaPassport;
const { InvalidConfiguration } = require('../Errors');

module.exports = {

    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.SERVICE,

    /**
     * Load the feature
     * @param {Routable} app - The app module object
     * @param {object} config - Passport settings
     * @property {bool} [config.useSession=false] - Use session or not, default: false
     *  
     * @property {object} config.init - Passport initialization settings     
     * @property {string} [config.init.userProperty='user'] - User property name, default: user      
     * 
     * @property {object} config.auth - Passport authentication settings     
     * @property {string} config.auth.loginUrl - The url of login page           
     * @property {string} [config.auth.successRedirect] - After successful login, user will redirect to given URL if successReturnToOrRedirect not set
     * @property {string} [config.auth.successReturnToOrRedirect='/'] - After successful login, if session.returnTo exists, then the user will be redirected to session.returnTo else to the given URL     
     * 
     * @property {array} config.strategies - Passport strategies, e.g. [ 'local', 'facebook' ]
     * @returns {Promise.<*>}
     */
    load_: function (app, config) {
        let passport = new KoaPassport();
        if (_.isEmpty(config) || _.isEmpty(config.strategies)) {
            throw new InvalidConfiguration(
                'Missing passport strategies.',
                app,
                'passport.strategies'
            );
        }        

        passport.config = {             
            init: { ...config.init },
            auth: { loginUrl: '/login', successReturnToOrRedirect: '/', ...config.auth }, 
            ..._.omit(config, ['init', 'auth'])
        };        

        let initializeMiddleware = passport.initialize(passport.config.init);

        app.on('before:' + Feature.PLUGIN, () => {
            app.useMiddlewares(app.router, passport.config.useSession ? [ initializeMiddleware, passport.session() ] : initializeMiddleware);
        });

        app.registerService('passport', passport);

        let strategies = Array.isArray(config.strategies) ? config.strategies : [ config.strategies ];

        return eachAsync_(strategies, async strategy => {
            let strategyScript = path.join(app.backendPath, 'passports', strategy + '.js');
            let strategyInitiator = require(strategyScript);
            return strategyInitiator(app, passport);
        });
    }
};
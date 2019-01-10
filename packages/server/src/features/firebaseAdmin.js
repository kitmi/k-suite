"use strict";

/**
 * Enable firebase feature.
 * @module Feature_Firebase
 */

const { Feature } = require('..').enum;
const { tryRequire } = require('@k-suite/app/lib/utils/Helpers');
const { InvalidConfiguration } = require('../Errors');
const { fs } = require('rk-utils');

module.exports = {

    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.SERVICE,

    /**
     * Load the feature
     * @param {App} app - The app module object
     * @param {object} options - Options for the feature
     * @property {string} options.serviceAccount - The serivceAccount config file path.
     * @returns {Promise.<*>}
     */
    load_: async function (app, options) {
        if (!options || typeof options.serviceAccount !== 'string') {
            throw new InvalidConfiguration('Missing required configuration item "firebase.serviceAccount".');
        }

        const admin = tryRequire('firebase-admin');

        const serviceAccount = await fs.readJson(options.serviceAccount, 'utf8');

        const firebaseAdminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        app.registerService('firebaseAdmin', firebaseAdminApp);
    }
};
"use strict";

/**
 * Enable timezone feature
 * @module Feature_Timezone
 */

const Feature = require('@k-suite/cli-app/lib/enum/Feature');
const Literal = require('../enum/Literal');
const { DateTime } = require('luxon');
const { InvalidConfiguration } = require('../Errors');

module.exports = {

    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.INIT,

    /**
     * Load the feature
     * @param {CliApp} app - The app module object
     * @param {string} timezone - Timezone info
     * @returns {Promise.<*>}
     */
    load_: (app, timezone) => {
        if (typeof timezone !== 'string') {
            throw new InvalidConfiguration('Timezone value should be a string.', app, 'timezone');
        }

        app.now = () => DateTime.local().setZone(timezone || Literal.DEFAULT_TIMEZONE);
    }
};
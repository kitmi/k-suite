"use strict";

/**
 * Enable bootstrap scripts
 * @module Feature_Bootstrap
 */

const path = require('path');
const Feature = require('../enum/Feature');
const Literal = require('../enum/Literal');
const Util = require('rk-utils');

module.exports = {

    /**
     * This feature is loaded at init stage
     * @member {string}
     */
    type: Feature.INIT,

    /**
     * Load the feature
     * @param {App} app - The cli app module object
     * @param {object} options - Options for the feature
     * @property {string} [options.path='boostrap'] - The path of the bootstrap scripts
     * @returns {Promise.<*>}
     */
    load_: async function (app, options) {
        let bootPath = options.path ?
            app.toAbsolutePath(options.path) :
            path.join(app.workingPath, Literal.DEFAULT_BOOTSTRAP_PATH);

        let bp = path.join(bootPath, '**', '*.js');

        let files = await Util.glob(bp, {nodir: true});
        
        return Util.eachAsync_(files, async file => {
            let bootstrap = require(file);
            return bootstrap(app);
        });
    }
};
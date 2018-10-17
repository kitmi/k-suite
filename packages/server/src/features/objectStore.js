"use strict";

/**
 * Enable object store feature
 * @module Feature_ObjectStore
 */

const _ = require('rk-utils')._;
const Feature = require('@k-suite/cli-app/lib/enum/Feature');
const Literal = require('../enum/Literal');
const { DateTime } = require('luxon');
const { ServerError } = require('../Errors');

class Store {
    constructor(app) {
        this._app = app;
        this._store = new Map();
        this._factory = {};
    }

    registerFactory(name, factory) {
        this._factory[name] = factory;
    }

    createAndStore(name) {
        if (this._store.has(name)) {
            throw new ServerError(`"${name}" already in store and don't need to create another.`);
        }

        let factory = this._factory[name];
        if (!factory || typeof factory !== 'function') {
            throw new ServerError(`Factroy for making "${name}" not found or invalid!`);
        }

        let obj = factory(this._app);
        this._store.set(name, obj);
        return obj;
    }

    ensureOne(name) {
        return this._store.get(name) || this.createAndStore(name);
    }
}

module.exports = {

    /**
     * This feature is loaded at plug-in stage
     * @member {string}
     */
    type: Feature.PLUGIN,

    /**
     * Load the feature
     * @param {CliApp} app - The app module object
     * @param {object} factories - Object factories
     * @returns {Promise.<*>}
     */
    load_: (app, factories) => {
        let store = new Store(app);

        _.forOwn(factories, (factory, name) => {
            store.registerFactory(name, factory);
        });

        app.store = store;
    }
};
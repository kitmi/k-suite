"use strict";

const Mowa = require('../../server.js');
const Util = Mowa.Util;
const _ = Util._;

const Errors = require('./errors.js');
const { ModelValidationError, ModelOperationError } = Errors;

const Generators = require('./generators.js');
const Validators = require('./validators.js');

class View {
    /**
     * View object
     *      
     * @constructs View
     */
    constructor() {
        this.appModule = this.db.appModule;
    }

    get db() {
        return this.constructor.db;
    }

    get meta() {
        return this.constructor.meta;
    }

    async load(params) {
        return this._doLoad(params);
    }
}

module.exports = View;
"use strict";

const Mowa = require('../../server.js');
const Util = Mowa.Util;
const _ = Util._;

const Errors = require('./errors.js');
const { DataValidationError, DsOperationError } = Errors;

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
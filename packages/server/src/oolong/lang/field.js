"use strict";

const Util = require('../../util.js');
const _ = Util._;

class OolongField {
    /**
     * Oolong entity field
     * @constructs OolongField
     * @param {string} name
     * @param {object} rawInfo
     */
    constructor(name, rawInfo) {
        Object.assign(this, rawInfo);

        /**
         * The name of the field
         * @type {string}
         * @public
         */
        this.name = name;

        /**
         * The default name of the field
         * @type {string}
         * @public
         */
        this.displayName = Util.normalizeDisplayName(this.name);
    }

    /**
     * Clone the field
     * @param {Map} [stack] - Reference stack to avoid recurrence copy
     * @returns {OolongField}
     */
    clone(stack) {
        return new OolongField(this.name, _.toPlainObject(this));
    }

    /**
     * Translate the field into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return _.toPlainObject(this);
    }
}

module.exports = OolongField;
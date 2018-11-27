"use strict";

const { _ } = require('rk-utils');
const { generateDisplayName, deepCloneField, Clonable, fieldNaming } = require('./OolUtils');

/**
 * Oolong entity field class.
 * @class
 */
class Field extends Clonable {
    /**
     * @param {string} name
     * @param {object} info
     */
    constructor(name, info) {
        super();

        this.name = fieldNaming(this.name);

        /**
         * Original type information.
         * @member {object}
         */
        this.info = info;        
    }

    /**
     * Linking the 
     */
    link() {
        Object.assign(this, this.info);

        /**
         * The default name of the field
         * @member {string}
         */
        this.displayName = this.comment || generateDisplayName(this.name);        

        deepCloneField(this.info, this, 'modifiers');

        this.linked = true;
    }

    /**
     * Clone the field     
     * @returns {Field}
     */
    clone() {
        super.clone();

        let field = new Field(this.name, this.info);
        Object.assign(field, this.toJSON());
        field.linked = true;
        
        return field;
    }

    /**
     * Translate the field into a plain JSON object
     * @returns {object}
     */
    toJSON() {
        return _.omit(_.toPlainObject(this), [ 'linked', 'info' ]);
    }
}

module.exports = Field;
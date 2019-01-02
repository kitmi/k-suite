"use strict";

const { _ } = require('rk-utils');
const { generateDisplayName, deepCloneField, Clonable, fieldNaming } = require('./OolUtils');
const Types = require('./types');
const RESERVED_KEYS = new Set(['name', 'type', 'modifiers', 'subClass', 'values']);

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

        this.name = fieldNaming(name);

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
        assert: Types.Builtin.has(this.info.type);
        let typeObject = Types[this.info.type];

        _.forOwn(this.info, (value, key) => {
            if (RESERVED_KEYS.has(key)) {
                this[key] = value;
                return;
            }       

            if (!typeObject.qualifiers.includes(key)) {
                this[key] = value;                
                return;
            }

            this[key] = Array.isArray(value) ? value[0] : value;
        });

        /**
         * The default name of the field
         * @member {string}
         */
        this.displayName = this.comment || generateDisplayName(this.name);        

        deepCloneField(this.info, this, 'modifiers');

        this.linked = true;
    }

    hasSameType(targetField) {
        return _.isEqual(this.toJSON(), targetField);
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
        return _.omit(_.toPlainObject(this), [ 'name', 'linked', 'info' ]);
    }
}

module.exports = Field;
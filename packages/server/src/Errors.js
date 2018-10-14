"use strict";

/**
 * Error definitions.
 * @module Errors
 */

const HttpCode = require('http-status-codes');

/**
 * @mixin
 * @param {*} Base 
 */
const withName = (Base) => class extends Base {
    /**     
     * @param {string} message 
     */
    constructor(message) {
        super(message);

        /**
         * Error name.
         * @member {string}
         */
        this.name = this.constructor.name;
    }    
};

/**
 * @mixin
 * @param {*} Base 
 * @param {*} STATUS 
 */
const withHttpStatus = (Base, STATUS) => class extends Base {
    /**
     * Http status code.
     * @member {number}
     */
    status = STATUS;
};

/**
 * @mixin
 * @param {*} Base 
 */
const withExtraInfo = (Base) => class extends Base {
    /**     
     * @param {string} message 
     * @param {object} extraInfo 
     */
    constructor(message, extraInfo) {
        super(message);
        /**
         * Extra error info.
         * @member {object}
         */
        this.extraInfo = extraInfo;
    }
};

/**
 * Error caused by invalid configuration
 * @class
 * @extends Error  
 */
class InvalidConfiguration extends withExtraInfo(withName(withHttpStatus(Error, HttpCode.INTERNAL_SERVER_ERROR))) {
    /**
     * @param {string} message - Error message
     * @param {AppModule} [appModule] - The related app module
     * @param {string} [item] - The related config item   
     */ 
    constructor(message, appModule, item) {        
        super(message, { app: appModule.displayName, configNode: item });
    }
}

/**
 * Http BadRequest, 400
 * @class 
 * @extends Error
 */
class BadRequest extends withExtraInfo(withName(withHttpStatus(Error, HttpCode.BAD_REQUEST))) {

};

/**
 * Error caused by all kinds of runtime errors
 * @class
 * @extends Error 
 */
class ServerError extends withExtraInfo(withName(withHttpStatus(Error, HttpCode.INTERNAL_SERVER_ERROR))) {
    /**     
     * @param {string} message - Error message
     * @param {*} code 
     * @param {*} otherExtra
     */
    constructor(message, code, otherExtra) {
        if (arguments.length === 2 && typeof code === 'object') {
            otherExtra = code;
            code = undefined;            
        } else if (code !== undefined && otherExtra && !('code' in otherExtra)) {
            otherExtra = Object.assign({}, otherExtra, { code });
        }

        super(message, otherExtra);

        if (code !== undefined) {
            /**
             * Error Code
             * @member {integer|string}
             */
            this.code = code;
        }
    }
}

exports.withName = withName;
exports.withHttpStatus = withHttpStatus;
exports.withExtraInfo = withExtraInfo;
exports.BadRequest = BadRequest;
exports.InvalidConfiguration = InvalidConfiguration;
exports.ServerError = ServerError;
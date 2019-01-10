"use strict";

/**
 * Error definitions.
 * @module Errors
 */

const { withName, withExtraInfo } = require('@k-suite/app/lib/utils/Helpers');
const HttpCode = require('http-status-codes');

/**
 * Adds a status property to the class.
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
 * Error caused by invalid configuration.
 * @class
 * @extends Error  
 * @mixes withHttpStatus
 * @mixes withName
 * @mixes withExtraInfo 
 */
class InvalidConfiguration extends withExtraInfo(withName(withHttpStatus(Error, HttpCode.INTERNAL_SERVER_ERROR))) {
    /**
     * @param {string} message - Error message
     * @param {App} [app] - The related app module
     * @param {string} [item] - The related config item   
     */ 
    constructor(message, app, item) {        
        super(message, { app: app.name, configNode: item });
    }
}

/**
 * Http BadRequest, 400.
 * @class 
 * @extends Error
 * @mixes withHttpStatus
 * @mixes withName
 * @mixes withExtraInfo 
 */
class BadRequest extends withExtraInfo(withName(withHttpStatus(Error, HttpCode.BAD_REQUEST))) {

};

/**
 * Error caused by all kinds of runtime errors.
 * @class
 * @extends Error 
 * @mixes withHttpStatus
 * @mixes withName
 * @mixes withExtraInfo 
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

exports.withHttpStatus = withHttpStatus;
exports.BadRequest = BadRequest;
exports.InvalidConfiguration = InvalidConfiguration;
exports.ServerError = ServerError;
"use strict";

const Util = require('rk-utils');
const Errors = require('../../Errors');
const _ = Util._;

/**
 * Errors caused by failing to pass input validation
 * @class Errors:ModelValidationError
 * @extends Errors:BadRequest
 */
class ModelValidationError extends Errors.BadRequest {
}

/**
 * Errors occurred during model operation.
 * @class Errors:ModelUsageError
 * @extends Errors:ServerError
 */
class ModelUsageError extends Errors.ServerError {
}

/**
 * Errors occurred during model operation.
 * @class Errors:ModelOperationError
 * @extends Errors:ServerError
 */
class ModelOperationError extends Errors.ServerError {    
}

exports.ModelValidationError = ModelValidationError;
exports.ModelUsageError = ModelUsageError;
exports.ModelOperationError = ModelOperationError;
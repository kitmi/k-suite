"use strict";

const Util = require('rk-utils');
const _ = Util._;

const validator = require('validator');
const Convertors = require('./Convertors');
const Types = require('./Types');
const { ServerError } = require('../../Errors');
const { ModelValidationError } = require('./Errors');

function processInt(meta, raw) {
    let sanitized = raw;

    if (!_.isInteger(sanitized)) {
        sanitized = validator.toInt(sanitized);
    }

    return { raw, sanitized };
}

function processFloat(meta, raw) {
    let sanitized = raw;

    if (!_.isNumber(sanitized)) {
        sanitized = validator.toFloat(sanitized);
        if (isNaN(sanitized)) {
            throw new ModelValidationError(`Invalid "${meta.name}" which should be a float number.`, { fieldInfo: meta });
        }
    }

    if ('decimalDigits' in meta) {
        sanitized = parseFloat(sanitized.toFixed(meta.decimalDigits));
    }

    return { raw, sanitized };
}

function processBool(meta, raw) {
    return { raw, sanitized: Convertors.toBoolean(raw) };
}

function processText(meta, raw) {
    return { raw, sanitized: Convertors.toText(raw) };
}

function processBinary(meta, input) {
    let sanitized = (input instanceof Buffer) ? input : Buffer.from(input.toString());

    return { input, sanitized };
}

function processDatetime(meta, raw) {
    let sanitized = raw;

    if (!(sanitized instanceof Date)) {
        sanitized = validator.toDate(sanitized);

        if (!sanitized) {
            throw new ModelValidationError(`Invalid "${meta.name}" which should be a datetime value.`, { fieldInfo: meta });
        }
    }

    return { raw, sanitized };
}

function processJson(meta, raw) {
    let sanitized = raw;

    if (typeof sanitized === 'string') {
        sanitized = sanitized.trim();
    } else {
        sanitized = JSON.stringify(sanitized);
    }
    
    return { raw, sanitized };
}

function processXml(meta, raw) {
    const xml = require("tiny-xml");

    let sanitized = raw;

    let type = typeof sanitized;
    if (type !== 'string') {
        sanitized = xml.serialize(sanitized);
    } else if (!xml.valid(sanitized)) {
        throw new ModelValidationError(`Invalid "${meta.name}" which should be a XML document.`, { fieldInfo: meta });
    }

    return { raw, sanitized };
}

function processEnum(meta, raw) {
    let sanitized = raw;

    if (typeof sanitized === 'string') {
        sanitized = sanitized.trim();
        if (meta.values.indexOf(sanitized) > -1) {
            return { raw, sanitized };
        }
    } 

    throw new ModelValidationError(`Invalid "${meta.name}" which should be one of [${ meta.values.join(', ') }].`, { fieldInfo: meta });    
}

function processCsv(meta, raw) {
    let sanitized = raw;

    if (Array.isArray(sanitized)) {
        sanitized = sanitized.map(a => Types.escapeCsv(a)).join(',');
    } else if (_.isPlainObject(sanitized)) {
        sanitized = Object.values(sanitized).map(a => Types.escapeCsv(a)).join(',');
    } else {
        throw new ModelValidationError(`Invalid "${meta.name}" which should be a comma-separated value.`, { fieldInfo: meta });
    }

    return { raw, sanitized };
}

module.exports = _.pick(validator, [ 
    'equals',
    'contains',
    'matches',
    'isEmail',
    'isURL',
    'isMACAddress',
    'isIP',
    'isFQDN',
    'isBoolean',
    'isAlpha',
    'isAlphanumeric',
    'isNumeric',
    'isPort',
    'isLowercase',
    'isUppercase',
    'isAscii',
    'isFullWidth',
    'isHalfWidth',
    'isVariableWidth',
    'isMultibyte',
    'isSurrogatePair',
    'isInt',
    'isFloat',
    'isDecimal',
    'isHexadecimal',
    'isDivisibleBy',
    'isHexColor',
    'isISRC',
    'isMD5',
    'isHash',
    'isJSON',
    'isEmpty',
    'isLength',
    'isByteLength',
    'isUUID',
    'isMongoId',
    'isAfter',
    'isBefore',
    'isIn',
    'isCreditCard',
    'isISIN',
    'isISBN',
    'isISSN',
    'isMobilePhone',
    'isPostalCode',
    'isCurrency',
    'isISO8601',
    'isISO31661Alpha2',
    'isBase64',
    'isDataURI',
    'isMimeType',
    'isLatLong'
]);

module.exports.min = function (value, minValue) {
    return value >= minValue;
};

module.exports.max = function (value, maxValue) {
    return value <= maxValue;
};

module.exports.gt = function (value, minValue) {
    return value > minValue;
};

module.exports.lt = function (value, maxValue) {
    return value < maxValue;
};

module.exports.maxLength = function (value, maxLength) {
    return value.length <= maxLength;
};

module.exports.$processInt = processInt;
module.exports.$processFloat = processFloat;
module.exports.$processBool = processBool;
module.exports.$processText = processText;
module.exports.$processBinary = processBinary;
module.exports.$processDatetime = processDatetime;
module.exports.$processJson = processJson;
module.exports.$processXml = processXml;
module.exports.$processEnum = processEnum;
module.exports.$processCsv = processCsv;

module.exports.$sanitize = function (meta, value) {
    let result;

    switch (meta.type) {
        case Types.TYPE_INT:
            result = processInt(meta, value);
            break;
        case Types.TYPE_FLOAT:
            result = processFloat(meta, value);
            break;
        case Types.TYPE_BOOL:
            result = processBool(meta, value);
            break;
        case Types.TYPE_TEXT:
            result = processText(meta, value);
            break;
        case Types.TYPE_BINARY:
            result = processBinary(meta, value);
            break;
        case Types.TYPE_DATETIME:
            result = processDatetime(meta, value);
            break;
        case Types.TYPE_JSON:
            result = processJson(meta, value);
            break;
        case Types.TYPE_XML:
            result = processXml(meta, value);
            break;
        case Types.TYPE_ENUM:
            result = processEnum(meta, value);
            break;
        case Types.TYPE_CSV:
            result = processCsv(meta, value);
            break;
        default:
            throw new ServerError('Unknown field type: ' + meta.type);
    }

    return result;
};
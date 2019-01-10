 const { _ } = require('rk-utils');
 const { Set } = require('immutable');

const ARRAY = require('./array');
const BINARY = require('./binary');
const BOOLEAN = require('./boolean');
const ENUM = require('./enum');    
const DATETIME = require('./datetime');
const INTEGER = require('./integer');
const NUMBER = require('./number');
const OBJECT = require('./object');
const TEXT = require('./text');

const types = {
    ARRAY, BINARY, BOOLEAN, ENUM, DATETIME, INTEGER, NUMBER, OBJECT, TEXT
};

module.exports = Object.assign(types, { ..._.mapKeys(types, (v, k) => v.name), Builtin: Set(_.map(types, t => t.name)) });
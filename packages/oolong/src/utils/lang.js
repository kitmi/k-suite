"use strict";

const { _ } = require('rk-utils');

const SupportedDrivers = [ 'mysql', 'mongodb' ];
const JsPrimitiveTypes = new Set([ 'number', 'boolean', 'string', 'symbol', 'undefined' ]);

exports.isNothing = v => _.isNil(v) || _.isNaN(v);
exports.isPrimitive = v => JsPrimitiveTypes.has(typeof v);
exports.isQuoted = s => (s.startsWith("'") || s.startsWith('"')) && s[0] === s[s.length-1];
exports.isQuotedWith = (s, q) => (s.startsWith(q) && s[0] === s[s.length-1]);
exports.makeDataSourceName = (driver, schema) => (driver + '.' + schema);
exports.extractDriverAndConnectorName = id => id.split('.');
exports.SupportedDrivers = Object.freeze(SupportedDrivers);
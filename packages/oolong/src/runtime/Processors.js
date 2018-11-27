"use strict";

const { _ } = require('rk-utils');

module.exports = {
    stringDasherize: s => _.words(s).join('-')
};
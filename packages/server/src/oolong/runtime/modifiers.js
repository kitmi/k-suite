"use strict";

const Util = require('../../util.js');
const _ = Util._;

module.exports = {
    stringDasherize: s => _.words(s).join('-')
};
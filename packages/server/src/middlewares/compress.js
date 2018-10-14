"use strict";

/**
 * Compress middleware.
 * @module Middleware_Compress
 */

/**
 * @function
 * @param {Object} options - The options are passed to zlib: http://nodejs.org/api/zlib.html#zlib_options
 * @example
 *  compress: {
 *      filter: "#!jsv: content_type => /text/i.test(content_type)",
 *      threshold: 2048,
 *      flush: "#!jst: ${require('zlib').Z_SYNC_FLUSH}"
 *  }
 */
const koaCompress = require('koa-compress');

module.exports = koaCompress;
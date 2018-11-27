"use strict";

/**
 * @module Middleware_FlashMessage
 * @summary Flash Messages Middleware
 */

import flashMessage from 'koa-flash-message';

/**
 add message to flash messages

 ctx.flashMessage.warning = 'Log Out Successfully!';

 read all flash messages

 ctx.state.flashMessage.messages
 // or ctx.flashMessage.messages

 read warning message

 ctx.state.flashMessage.warning
 */

module.exports = () => flashMessage;
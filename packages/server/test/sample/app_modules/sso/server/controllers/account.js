"use strict";

const commonViewState = require('../common/viewState');

exports.index = async ctx => {
  await ctx.render("account-index", {
    title: `${commonViewState.appTitle} - Account`,
    user: ctx.user
  });
};
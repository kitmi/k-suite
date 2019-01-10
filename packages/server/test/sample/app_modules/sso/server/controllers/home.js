"use strict";

const commonViewState = require('../common/viewState');

exports.index = async ctx => {
  await ctx.render("home-index", {
    title: `${commonViewState.appTitle} - Home`
  });
};
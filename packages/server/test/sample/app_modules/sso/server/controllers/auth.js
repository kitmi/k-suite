"use strict";

const commonViewState = require('../common/viewState');

exports.index = async ctx => {
  await ctx.render("login", {
    title: `${commonViewState.appTitle} - Login`
  });
};

exports.logout = async ctx => {

};
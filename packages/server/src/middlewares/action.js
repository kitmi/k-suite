"use strict";

/**
 * Response action as middleware
 * @module Middleware_Action
 */

const Util = require('rk-utils');
const _ = Util._;
const { InvalidConfiguration } = require('../Errors');
const Literal = require('../enum/Literal');

const path = require('path');

/**
 * Action middleware creator
 * @param {string} controllerAction 
 * @param {AppWithMiddleware} app 
 */
module.exports = (controllerAction, app) => {
    pre: {
        controllerAction, Util.Message.DBC_ARG_REQUIRED;
        app, Util.Message.DBC_ARG_REQUIRED;
    }

    if (typeof controllerAction !== 'string') {
        throw new InvalidConfiguration('Invalid action syntax.', app);
    }

    let pos = controllerAction.lastIndexOf('.');
    if (pos < 0) {
        throw new InvalidConfiguration(`Unrecognized controller & action syntax: ${controllerAction}.`, app);
    }

    let controller = controllerAction.substr(0, pos);
    let action = controllerAction.substr(pos + 1);
    let controllerBasePath = path.join(app.backendPath, Literal.CONTROLLERS_PATH);

    let controllerPath = path.resolve(controllerBasePath, controller + '.js');
    let ctrl;
    
    try {
        ctrl = require(controllerPath);    
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new InvalidConfiguration(
                `Controller "${controllerPath}" not found.`,
                app
            );
        }
    }

    let actioner = ctrl[action];   

    if (typeof actioner !== 'function') {
        throw new InvalidConfiguration(`${controllerAction} is not a valid action.`, app);
    }    

    return app.wrapAction(actioner);
};
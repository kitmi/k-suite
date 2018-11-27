"use strict";

const { validateAction, composeActions } = require('./utils/Helpers');

/**
 * Hash-based rules engine.
 * @class 
 */
class HashRules  {    
    constructor() {
        this._mapRules = {};
    }
        
    addRule(route, action) {
        validateAction(action);

        let actionsBucket = this._mapRules[route];
        if (!actionsBucket) {
            actionsBucket = [];
        }
        
        if (Array.isArray(action)) {
            actionsBucket = actionsBucket.concat(action);
        } else {
            actionsBucket.push(action);
        }

        this._mapRules[route] = actionsBucket;
    }

    async run_(route, facts) {
        let chains = this._buildActionsChain(route);

        return chains(facts);
    }

    _buildActionsChain(route) {
        let actions = this._mapRules[route];

        return composeActions(actions);
    }
}

module.exports = HashRules;
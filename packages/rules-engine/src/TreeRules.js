"use strict";

const Util = require('rk-utils');
const { _, ensureLeftSlash, trimRightSlash } = Util;
const { KeyTree } = require('@k-suite/algorithms/lib/Tree');

const { validateAction, composeActions } = require('./utils/Helpers');

/**
 * Tree-based rules engine.
 * @class
 */
class TreeRules {    
    constructor(rules) {
        this._rulesTree = new KeyTree('', rules);
    }
        
    addRule(route, action) {
        validateAction(action);

        let keys = this._routeToKeys(route);

        let node = this._rulesTree.findByKeyPath(keys);
        if (node) {
            assert: Array.isArray(node.data);

            node.data = node.data.concat(_.castArray(action));
        } else {
            this._rulesTree.appendDataByKeyPath(keys, _.castArray(action));
        }                
    }

    async run_(route, facts) {
        let chains = this._buildRulesChain(route);

        return chains(facts);
    }

    _buildRulesChain(route) {
        let keys = this._routeToKeys(route);
        let actions = [];

        let rootKey = keys.shift();
        if (rootKey !== this._rulesTree.key) {            
            throw new Error(`Node with path "${route}" not found.`);
        }

        if (this._rulesTree.data && this._rulesTree.data.length > 0) {
            actions = actions.concat(this._rulesTree.data);
        }
        
        let node = this._rulesTree; 

        keys.forEach(key => {
            node = node.children[key];
            if (!node) {
                console.log('key path:', keys);
                console.log('current key:', key);                
                throw new Error(`Node with path "${route}" not found.`);
            }

            if (node.data && node.data.length > 0) {
                actions = actions.concat(node.data);
            }
        })

        return composeActions(actions);
    }

    _routeToKeys(route) {
        route = ensureLeftSlash(route);

        if (route === '/') return [ '' ];

        route = trimRightSlash(route);

        return route.split('/');
    }
}

module.exports = TreeRules;
'use strict';

/**
 * Module dependencies.
 */

const Engine = require('../../lib/TreeRules');

describe('unit:treerules', function () {    
    let engine = new Engine([
        async (facts, next) => {
            facts.output = {
                flag: 1
            };

            return next();
        }
    ]);

    engine.addRule('/module1', [
        async (facts, next) => {
            facts.output.module1 = {
                applied: true
            };

            return next();
        }
    ]);

    engine.addRule('/module2', [
        async (facts, next) => {
            facts.output.module2 = {
                applied: true
            };

            return next();
        }
    ]);

    engine.addRule('/module1/rule1', [
        async (facts, next) => {
            facts.output.module1.rule1 = 'rule1 output1'
            return next();
        },
        async (facts) => {
            facts.output.module1.rule1Extra = 'rule1 extra'
        }
    ]);

    engine.addRule('/module1/rule2', [
        async (facts, next) => {
            if (facts.input.rule2) {
                facts.output.module1.rule2 = 'rule2 conditional output'
            }

            return next();
        },
        async (facts) => {
            facts.output.module1.rule2Extra = 'rule2 extra'
        }
    ]);

    it('rule1', async function () {
        let facts = {};

        await engine.run_('/module1/rule1', facts)

        facts.output.should.have.keys('flag', 'module1');
        facts.output.module1.should.have.keys('rule1', 'rule1Extra');
    });

    it('rule2', async function () {
        let facts = { input: { rule2: true } };

        await engine.run_('/module1/rule2', facts)

        facts.output.should.have.keys('flag', 'module1');
        facts.output.module1.should.have.keys('rule2', 'rule2Extra');
    });
});
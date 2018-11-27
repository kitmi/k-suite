'use strict';

/**
 * Module dependencies.
 */

const Engine = require('../../lib/HashRules');

describe('unit:hashrules', function () {    
    let engine = new Engine();

    function starter (facts, next) {
        facts.output = {
            flag: 1
        };    

        return next();
    }

    engine.addRule('module1.rule1', [
        starter,
        async (facts) => {
            facts.output.module = 1;
            facts.output.rule = 1;
        }
    ]);

    engine.addRule('module2.rule2', [
        starter,
        async (facts) => {
            facts.output.module = 2;
            facts.output.rule = 2;
        }
    ]);

    it('rule1', async function () {
        let facts = {};

        await engine.run_('module1.rule1', facts)

        facts.output.should.have.keys('flag', 'module', 'rule');
        facts.output.flag.should.be.exactly(1);
        facts.output.module.should.be.exactly(1);
        facts.output.rule.should.be.exactly(1);
    });

    it('rule2', async function () {
        let facts = {};

        await engine.run_('module2.rule2', facts)

        facts.output.should.have.keys('flag', 'module', 'rule');
        facts.output.flag.should.be.exactly(1);
        facts.output.module.should.be.exactly(2);
        facts.output.rule.should.be.exactly(2);
    });
});
'use strict';

const OolongParser = require('../lib/lang/grammar/oolong.js').parser;
const fs = require('fs');
const path = require('path');

const FIXTURES_FOLDER = path.resolve(__dirname, 'fixtures');
let fixtures = fs.readdirSync(FIXTURES_FOLDER);

describe('unit:grammar:oolong', function () {
    describe('test with fixtures', function () {
        fixtures.forEach(fixture => {
            if (fixture.startsWith('.')) return;
            it(fixture, function() {
                let input = path.join(FIXTURES_FOLDER, fixture, 'input.ool');
                let output = path.join(FIXTURES_FOLDER, fixture, 'output.json');

                let ool = OolongParser.parse(fs.readFileSync(input, 'utf8'));       
                
                //fs.writeFileSync(output, JSON.stringify(ool, null, 4), 'utf8');

                let expected = JSON.parse(fs.readFileSync(output, 'utf8'));
                ool.should.eql(expected);
            });            
        });
    });
});
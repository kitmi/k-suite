'use strict';

const { fs, runCmdSync } = require('rk-utils');
const path = require('path');
const pkg = require('../package.json');

const WORKING_FOLDER = path.resolve(__dirname, 'cli');
const OOLONG_CLI = 'node ../../lib/cli/oolong.js';

describe('e2e:cli:oolong', function () {
    before(function () {        
        process.chdir(WORKING_FOLDER);
    });

    after(function () {
        fs.removeSync(path.join(WORKING_FOLDER, 'oolong-cli.log'));
    });

    it('showUsage', function () {
        let output = runCmdSync(OOLONG_CLI);
        
        output.should.match(/Oolong command line helper/);
        output.should.match(/Available commands\:/);
        output.should.match(/Options\:/);
    }); 

    it('version', function () {
        let output = runCmdSync(OOLONG_CLI + ' -v');
        
        output.should.match(new RegExp('v' + pkg.version + '\n'));
    });

    it('help', function () {
        let output = runCmdSync(OOLONG_CLI + ' -?');
        
        output.should.match(/Oolong command line helper/);
        output.should.match(/Available commands\:/);
        output.should.match(/Options\:/);
    });
});
'use strict';

const { runCmdLive_, fs } = require('rk-utils');
const path = require('path');

const WORKING_FOLDER = path.resolve(__dirname, 'adhoc');

process.chdir(WORKING_FOLDER);

let onOutput = (info) => {
    console.log(info.toString());
};

runCmdLive_('node', [ '../../lib/cli/oolong.js', 'build', '-c', 'oolong-ool.json' ], onOutput, onOutput).then(code => {
    console.log('exit code:', code);
    fs.removeSync(path.join(WORKING_FOLDER, 'oolong-cli.log'));
}); 
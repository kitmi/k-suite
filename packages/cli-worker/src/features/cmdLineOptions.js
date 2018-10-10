"use strict";

/**
 * @module Feature_CmdLineOptions
 * @summary Parse command line arguments using minimist and store the parsed object into app.argv, and add app.showUsage() helper function
 */

const path = require('path');
const Feature = require('../enum/Feature');
const Util = require('rk-utils');

const minimist = require('minimist');

function translateMinimistOptions(opts) {
    let m = {};

    Util._.forOwn(opts, (detail, name) => {
        if (detail.isBool) {
            Util.putIntoBucket(m, 'boolean', name);
        } else {
            Util.putIntoBucket(m, 'string', name);
        }

        if ('default' in detail) {
            Util.setValueByPath(m, `default.${name}`, detail.default);
        }

        if (detail.alias) {
            Util.setValueByPath(m, `alias.${name}`, detail.alias);
        }
    });

    return m;
}

function optionDecorator(name) {
    return name.length == 1 ? ('-' + name) : ('--' + name);
}

module.exports = {

    /**
     * This feature is loaded at configuration stage
     * @member {string}
     */
    type: Feature.INIT,

    /**
     * Load the feature
     * @param {CliApp} app - The cli app module object
     * @param {object} featureOptions - Options for the feature     
     * @property {string} [featureOptions.banner] - Banner message or banner generator function
     * @property {array} [featureOptions.arguments] - Command line arguments, identified by the position of appearance
     * @property {object} [featureOptions.options] - Command line options
     * @returns {Promise.<*>}
     */
    load_: async (app, featureOptions) => {
        let argv = process.argv.slice(2);
        app.argv = minimist(argv, translateMinimistOptions(featureOptions.options));
        app.showUsage = () => {
            let usage = '';

            if (featureOptions.banner) {
                if (typeof featureOptions.banner === 'function') {
                    usage += featureOptions.banner(app);
                } else if (typeof featureOptions.banner === 'string') {
                    usage += featureOptions.banner;
                } else {
                    throw new Error('Invalid banner value of cmdLineOptions feature.');
                }

                usage += '\n';
            }            

            let fmtArgs = '';
            if (!Util._.isEmpty(featureOptions.arguments)) {
                fmtArgs = ' ' + featureOptions.arguments.map(arg => arg.required ? `<${arg.name}>` : `[${arg.name}]`).join(' ');
            }

            usage += `Usage: ${path.basename(process.argv[1])}${fmtArgs} [options]\n`;
            
            if (!Util._.isEmpty(featureOptions.options)) {
                usage += `\nOptions:\n`;
                Util._.forOwn(featureOptions.options, (opts, name) => {
                    let line = '  ' + optionDecorator(name);
                    if (opts.alias) {
                        line += Util._.reduce(opts.alias, (sum, a) => (sum + ', ' + optionDecorator(a)), '');
                    }

                    line += '\n';
                    line += '    ' + opts.desc + '\n';

                    if ('default' in opts) {
                        line += '    default: ' + opts.default.toString() + '\n';
                    }

                    if (opts.required) {
                        line += '    required\n';
                    }

                    line += '\n';

                    usage += line;
                });
            }        

            console.log(usage);
        }
    }
};
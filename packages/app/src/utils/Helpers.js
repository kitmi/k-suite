"use strict";

exports.dependsOn = function (features, app, fromFeature) {
    let hasNotEnabled = _.find(_.castArray(features), feature => !app.enabled(feature));

    if (hasNotEnabled) {
        throw new Error(`"${fromFeature}" feature requires "${hasNotEnabled}" feature to be enabled.`);
    }
};

exports.splitControllerAction = function (actionString) {
    let pos = actionString.lastIndexOf('.');
    if (pos <= 0) {
        throw new Error(`Unrecognized controller.action syntax: ${actionString}.`);
    }

    let controller = actionString.substr(0, pos);
    let action = actionString.substr(pos + 1);

    return { controller, action };
};

/**
 * Try require a package module and show install tips if not found.
 * @param {string} packageName
 */
exports.tryRequire = (packageName) => {
    try {
        return require(packageName);
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            let pkgPaths = packageName.split('/');
            let npmPkgName = pkgPaths[0];
            if (pkgPaths[0].startsWith('@') && pkgPaths.length > 1) {
                npmPkgName += '/' + pkgPaths[1];
            }

            throw new Error(`Module "${packageName}" not found. Try run "npm install ${npmPkgName}" to install the dependency.`);
        }

        throw error;
    }
};

/**
 * Add a name property of which the value is the class name.
 * @mixin
 * @param {*} Base 
 */
exports.withName = (Base) => class extends Base {    
    constructor(...args) {
        super(...args);

        /**
         * Error name.
         * @member {string}
         */
        this.name = this.constructor.name;
    }    
};

/**
 * Add an extraInfo property and passed in by extra construtor arguments.
 * @mixin
 * @param {*} Base 
 */
exports.withExtraInfo = (Base) => class extends Base {    
    constructor(...args) {
        super(...args);

        let expectedNumArgs = super.constructor.length;

        if (args.length > expectedNumArgs) {
            let extra = args.slice(expectedNumArgs);

            /**
             * Extra error info.
             * @member {object}
             */
            this.extraInfo = extra.length > 1 ? extra : extra[0];
        }
    }
};
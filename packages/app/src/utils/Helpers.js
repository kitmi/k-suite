"use strict";

exports.tryRequire = (packageName) => {
    try {
        return require(packageName);
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error(`Module "${packageName}" not found. Try run "npm install ${packageName}" to install the dependency.`);
        }

        throw error;
    }
};
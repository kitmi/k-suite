"use strict";

class DbDeployer {
    /**
     * Oolong database deployer
     * @constructs OolongDbDeployer
     * @param {object} context
     * @param {object} dbService
     */
    constructor(context, dbService) {
        this.logger = context.logger;
        this.appModule = context.currentApp;
        this.dbService = dbService;
    }
}

module.exports = DbDeployer;
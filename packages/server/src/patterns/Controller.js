"use strict";

/**
 * Controller base class.
 * @class
 */
class Controller {
    /**     
     * @param {AppWithMiddleware} app 
     */
    constructor(app) {
        this.app = app;
    }    
};

module.exports = Controller;
"use strict";

/**
 * Controller base class.
 * @class
 */
class Controller {
    /**     
     * @param {Routable} app 
     */
    constructor(app) {
        this.app = app;
    }    
};

module.exports = Controller;
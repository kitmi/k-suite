"use strict";

/**
 * Controller base class.
 * @class
 */
class Controller {
    /**     
     * @param {RoutableApp} app 
     */
    constructor(app) {
        this.app = app;
    }    
};

module.exports = Controller;
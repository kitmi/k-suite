"use strict";

const ServiceContainer = require('./ServiceContainer');
const Runable = require('./Runable');

/**
 * Cli app.
 * @class
 * @mixes {Runable}
 * @extends {ServiceContainer}     
 */
class App extends Runable(ServiceContainer) {
    constructor(name, options) {
        super(name || 'cli', options);
    }
}

module.exports = App;
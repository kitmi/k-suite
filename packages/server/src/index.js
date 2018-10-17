"use strict";

module.exports = {    
    http: require('./decorators/httpMethod'),
    middleware: (...names) => names.map(name => ({ name: 'fromStore', options: name })),
    WebServer: require('./WebServer'),
    Controller: require('./patterns/Controller'),
    DbService: require('./patterns/DbService')
};
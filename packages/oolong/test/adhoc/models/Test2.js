const { pascalCase } = require('rk-utils');

//const Connector = require('@k-suite/oolong/lib/runtime/drivers/mysql/Connector');
const Connector = require('../../../lib/runtime/drivers/mysql/Connector');

class Test2 {
    constructor(connection, options) {        
        this.connector = new Connector(this.constructor.dataSource, { connection, ...options });
    }

    model(entityName) {
        let modelClassName = pascalCase(entityName);
        const modelCreator = require(`./test2/${modelClassName}`);
        
        return modelCreator(this);
    }

    async close_() {
        return this.connector.end_();
    }
}

Test2.driver = 'mysql';
Test2.dataSource = 'fooBar';
Test2.schemaName = 'test2';

module.exports = Test2;
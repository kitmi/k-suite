const { pascalCase } = require('rk-utils');

//const Connector = require('@k-suite/oolong/lib/runtime/drivers/mysql/Connector');
const Connector = require('../../../lib/runtime/drivers/mysql/Connector');

class Test {
    constructor(connection, options) {        
        this.connector = new Connector(this.constructor.dataSource, { connection, ...options });
    }

    model(entityName) {
        let modelClassName = pascalCase(entityName);
        const modelCreator = require(`./test/${modelClassName}`);
        
        return modelCreator(this);
    }

    async close_() {
        return this.connector.end_();
    }
}

Test.driver = 'mysql';
Test.dataSource = 'fooBar';
Test.schemaName = 'test';

module.exports = Test;
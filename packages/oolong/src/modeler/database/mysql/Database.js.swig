const { pascalCase } = require('rk-utils');

//const Connector = require('@k-suite/oolong/lib/runtime/drivers/mysql/Connector');
const Connector = require('../../../lib/runtime/drivers/mysql/Connector');

class {{ className }} {
    constructor(connection, options) {        
        this.connector = new Connector(connection, options);
    }

    model(entityName) {
        let modelClassName = pascalCase(entityName);
        const modelCreator = require(`./{{ schemaName }}/${modelClassName}`);
        
        return modelCreator(this);
    }

    async close_() {
        await this.connector.end_();
        delete this.connector;
    }
}

{{ className }}.driver = 'mysql';
{{ className }}.schemaName = '{{ schemaName }}';

module.exports = {{ className }};
const { pascalCase } = require('rk-utils');

//const Connector = require('@k-suite/oolong/lib/runtime/drivers/mysql/Connector');
const Connector = require('../../../lib/runtime/drivers/mysql/Connector');

class {{ className }} {
    constructor(connection, options) {        
        this.connector = new Connector(this.constructor.dataSource, { connection, ...options });
    }

    model(entityName) {
        let modelClassName = pascalCase(entityName);
        const modelCreator = require(`./{{ schemaName }}/${modelClassName}`);
        
        return modelCreator(this);
    }

    async close_() {
        return this.connector.end_();
    }
}

{{ className }}.driver = 'mysql';
{{ className }}.dataSource = '{{ dataSource }}';
{{ className }}.schemaName = '{{ schemaName }}';

module.exports = {{ className }};
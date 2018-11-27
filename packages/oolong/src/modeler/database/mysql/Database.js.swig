const { pascalCase } = require('rk-utils');

const Connector = require('@k-suite/oolong/lib/runtime/drivers/mysql/Connector');

class {{ className }} {
    static dataSource = '{{ dataSource }}';
    static schemaName = '{{ schemaName }}';

    constructor(connection, options) {        
        this.defaultConnector = new Connector(this.constructor.dataSource, { connection, ...options });
    }

    createNewConnector() {
        return this.defaultConnector.createNew();
    }

    model(entityName) {
        let modelClassName = pascalCase(entityName);
        const modelCreator = require(`./mysql/{{ schemaName }}/${modelClassName}`);
        
        return modelCreator(this);
    }
}

module.exports = {{ className }};
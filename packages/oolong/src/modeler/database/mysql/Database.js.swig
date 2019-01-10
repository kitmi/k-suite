const { pascalCase } = require('rk-utils');

const Connector = require('@k-suite/oolong/lib/runtime/drivers/mysql/Connector');

class {{ className }} {
    constructor(connection, options) {     
        if (typeof connection === 'string') {
            this.connector = new Connector(connection, options);
            this._connectorOwner = true;
        } else {  
            assert: connection instanceof Connector;
            
            this.connector = connection;
            this.i18n = options;
        }
    }

    model(entityName) {
        let modelClassName = pascalCase(entityName);
        const modelCreator = require(`./{{ schemaName }}/${modelClassName}`);
        modelCreator.db = this;
        
        return modelCreator;
    }

    async close_() {
        if (this._connectorOwner) {
            await this.connector.end_();
            delete this._connectorOwner;
        }
        delete this.connector;
    }
}

{{ className }}.driver = 'mysql';
{{ className }}.schemaName = '{{ schemaName }}';

module.exports = {{ className }};
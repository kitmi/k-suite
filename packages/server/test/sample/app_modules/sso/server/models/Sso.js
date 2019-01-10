const { pascalCase } = require('rk-utils');

const Connector = require('@k-suite/oolong/lib/runtime/drivers/mysql/Connector');

class Sso {
    constructor(connection, options) {     
        if (arguments.length === 1 && connection instanceof Connector) {
            this.connector = connection;
        } else {  
            this.connector = new Connector(connection, options);
            this._connectorOwner = true;
        }
    }

    model(entityName) {
        let modelClassName = pascalCase(entityName);
        const modelCreator = require(`./sso/${modelClassName}`);
        
        return modelCreator(this);
    }

    async close_() {
        if (this._connectorOwner) {
            await this.connector.end_();
            delete this._connectorOwner;
        }
        delete this.connector;
    }
}

Sso.driver = 'mysql';
Sso.schemaName = 'sso';

module.exports = Sso;
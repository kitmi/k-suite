const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');

class Group extends EntityModel {
    static meta = {
        "schemaName": "test",
        "name": "group",
        "keyField": [
            "id"
        ],
        "fields": {
            "id": {
                "name": "id",
                "type": "integer",
                "auto": true,
                "readOnly": true,
                "fixedValue": true,
                "displayName": "Id"
            },
            "name": {
                "name": "",
                "type": "text",
                "maxLength": 255,
                "optional": true,
                "displayName": ""
            }
        },
        "indexes": [],
        "features": {
            "autoId": {
                "field": "id"
            }
        },
        "uniqueKeys": [
            [
                "id"
            ]
        ],
        "knowledge": {}
    };

    static async prepareEntityData__(context) {
        let {raw, latest} = context;
        return context;
    }
}

module.exports = db => { Group.db = db; return Group };
const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');

class Gender extends EntityModel {
    static meta = {
        "schemaName": "test",
        "name": "gender",
        "keyField": [
            "code"
        ],
        "fields": {
            "code": {
                "name": "",
                "type": "text",
                "maxLength": 1,
                "displayName": ""
            },
            "name": {
                "name": "",
                "type": "text",
                "maxLength": 20,
                "optional": true,
                "displayName": ""
            }
        },
        "indexes": [],
        "features": [],
        "uniqueKeys": [
            [
                "code"
            ]
        ],
        "knowledge": {}
    };

    static async prepareEntityData__(context) {
        let {raw, latest} = context;
        return context;
    }
}

module.exports = db => { Gender.db = db; return Gender };
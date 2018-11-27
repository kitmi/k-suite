const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');

class Profile extends EntityModel {
    static meta = {
        "schemaName": "test",
        "name": "profile",
        "keyField": [
            "id"
        ],
        "fields": {
            "id": {
                "name": "",
                "type": "text",
                "maxLength": 32,
                "displayName": ""
            }
        },
        "indexes": [],
        "features": [],
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

module.exports = db => { Profile.db = db; return Profile };
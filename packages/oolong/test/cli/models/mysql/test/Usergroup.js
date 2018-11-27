const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');

class Usergroup extends EntityModel {
    static meta = {
        "schemaName": "test",
        "name": "usergroup",
        "keyField": [
            "userid",
            "groupid"
        ],
        "fields": {},
        "indexes": [],
        "features": [],
        "uniqueKeys": [
            [
                "userid",
                "groupid"
            ]
        ],
        "knowledge": {}
    };

    static async prepareEntityData__(context) {
        let {raw, latest} = context;
        return context;
    }
}

module.exports = db => { Usergroup.db = db; return Usergroup };
const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');

class User extends EntityModel {
    static meta = {
        "schemaName": "test",
        "name": "user",
        "keyField": "id",
        "fields": {
            "id": {
                "name": "id",
                "type": "integer",
                "auto": true,
                "readOnly": true,
                "fixedValue": true,
                "startFrom": 100000,
                "displayName": "Id"
            },
            "email": {
                "name": "email",
                "type": "text",
                "maxLength": 200,
                "modifiers": [
                    {
                        "oolType": "Validator",
                        "name": "isEmail"
                    }
                ],
                "displayName": "Email",
                "optional": true
            },
            "mobile": {
                "name": "mobile",
                "type": "text",
                "maxLength": 20,
                "modifiers": [
                    {
                        "oolType": "Validator",
                        "name": "isMobilePhone",
                        "args": {
                            "oolType": "PipedValue",
                            "value": {
                                "oolType": "ObjectReference",
                                "name": "latest.locale"
                            },
                            "modifiers": [
                                {
                                    "oolType": "Processor",
                                    "name": "stringDasherize"
                                }
                            ]
                        }
                    },
                    {
                        "oolType": "Processor",
                        "name": "normalizeMobile"
                    }
                ],
                "displayName": "Mobile",
                "optional": true
            },
            "status": {
                "name": "status",
                "type": "enum",
                "values": [
                    "inactive",
                    "active",
                    "disabled",
                    "forbidden",
                    "deleted"
                ],
                "default": "inactive",
                "displayName": "Status"
            },
            "createdAt": {
                "name": "",
                "type": "datetime",
                "auto": true,
                "readOnly": true,
                "fixedValue": true,
                "displayName": ""
            },
            "updatedAt": {
                "name": "",
                "type": "datetime",
                "readOnly": true,
                "forceUpdate": true,
                "optional": true,
                "displayName": ""
            },
            "statusInactiveTimestamp": {
                "name": "",
                "type": "datetime",
                "readOnly": true,
                "optional": true,
                "auto": true,
                "fixedValue": true,
                "displayName": ""
            },
            "statusActiveTimestamp": {
                "name": "",
                "type": "datetime",
                "readOnly": true,
                "optional": true,
                "auto": true,
                "fixedValue": true,
                "displayName": ""
            },
            "statusDisabledTimestamp": {
                "name": "",
                "type": "datetime",
                "readOnly": true,
                "optional": true,
                "auto": true,
                "fixedValue": true,
                "displayName": ""
            },
            "statusForbiddenTimestamp": {
                "name": "",
                "type": "datetime",
                "readOnly": true,
                "optional": true,
                "auto": true,
                "fixedValue": true,
                "displayName": ""
            },
            "statusDeletedTimestamp": {
                "name": "",
                "type": "datetime",
                "readOnly": true,
                "optional": true,
                "auto": true,
                "fixedValue": true,
                "displayName": ""
            }
        },
        "indexes": [],
        "features": {
            "autoId": {
                "field": "id"
            },
            "createTimestamp": {
                "field": "createdAt"
            },
            "updateTimestamp": {
                "field": "updatedAt"
            },
            "logicalDeletion": {
                "field": "status",
                "value": "deleted"
            },
            "stateTracking": [
                {
                    "field": "status"
                }
            ],
            "atLeastOneNotNull": [
                [
                    "email",
                    "mobile"
                ]
            ]
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

module.exports = db => { User.db = db; return User };
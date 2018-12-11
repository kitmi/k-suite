const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');
const normalizeMobile = require('../processors/user-normalizeMobile.js');
const hashPassword = require('../processors/user-hashPassword.js');

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
                "displayName": "Id",
                "autoIncrementId": true,
                "defaultByDb": true
            },
            "email": {
                "name": "email",
                "type": "text",
                "maxLength": [
                    200
                ],
                "modifiers": [
                    {
                        "oolType": "Validator",
                        "name": "isEmail"
                    }
                ],
                "subClass": [
                    "email"
                ],
                "displayName": "Email",
                "optional": true
            },
            "mobile": {
                "name": "mobile",
                "type": "text",
                "maxLength": [
                    20
                ],
                "modifiers": [
                    {
                        "oolType": "Validator",
                        "name": "isMobilePhone",
                        "args": [
                            {
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
                        ]
                    },
                    {
                        "oolType": "Processor",
                        "name": "normalizeMobile"
                    }
                ],
                "subClass": [
                    "phone"
                ],
                "displayName": "Mobile",
                "optional": true
            },
            "password": {
                "name": "password",
                "type": "text",
                "maxLength": [
                    200
                ],
                "modifiers": [
                    {
                        "oolType": "Processor",
                        "name": "hashPassword",
                        "args": [
                            {
                                "oolType": "ObjectReference",
                                "name": "latest.passwordSalt"
                            }
                        ]
                    }
                ],
                "subClass": [
                    "password"
                ],
                "displayName": "Password",
                "defaultByDb": true
            },
            "passwordSalt": {
                "name": "passwordSalt",
                "type": "text",
                "fixedLength": [
                    8
                ],
                "auto": true,
                "displayName": "Password Salt"
            },
            "locale": {
                "name": "locale",
                "type": "text",
                "default": [
                    "en_AU"
                ],
                "displayName": "Locale"
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
                "default": [
                    "inactive"
                ],
                "subClass": [
                    "userStatus"
                ],
                "displayName": "Status"
            },
            "createdAt": {
                "name": "",
                "type": "datetime",
                "auto": true,
                "readOnly": true,
                "fixedValue": true,
                "displayName": "",
                "isCreateTimestamp": true,
                "defaultByDb": true
            },
            "updatedAt": {
                "name": "",
                "type": "datetime",
                "readOnly": true,
                "forceUpdate": true,
                "optional": true,
                "displayName": "",
                "isUpdateTimestamp": true,
                "updateByDb": true
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
        "indexes": [
            {
                "fields": [
                    "email"
                ],
                "unique": true
            },
            {
                "fields": [
                    "mobile"
                ],
                "unique": true
            }
        ],
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
            ],
            [
                "email"
            ],
            [
                "mobile"
            ]
        ],
        "fieldDependencies": {
            "password": [
                "latest.passwordSalt"
            ],
            "mobile": [
                "latest.locale"
            ]
        }
    };

    static async applyModifiers_(context) {
        let {raw, latest, existing, i18n} = context;
        if ('email' in latest) {
            //Validating "email"
            if (!Validators.isEmail(latest.email)) {
                throw new DataValidationError('Invalid "email".', {
                    entity: this.meta.name,
                    field: 'email'
                });
            }
        }
        if ('passwordSalt' in latest || 'password' in latest) {
            if (!('password' in latest)) {
                throw new ModelUsageError('"password" is required due to change of its dependencies. (e.g: passwordSalt)');
            }
            if (!('passwordSalt' in latest)) {
                throw new ModelUsageError('"passwordSalt" is required by the filter function of "password".');
            }
            //Processing "password"
            latest.password = hashPassword(latest.password, latest.passwordSalt);
        }
        if ('locale' in latest || 'mobile' in latest) {
            if (!('mobile' in latest)) {
                throw new ModelUsageError('"mobile" is required due to change of its dependencies. (e.g: locale)');
            }
            if (!('locale' in latest)) {
                throw new ModelUsageError('"locale" is required by the filter function of "mobile".');
            }
            //Validating "mobile"
            if (!Validators.isMobilePhone(latest.mobile, Processors.stringDasherize(latest.locale))) {
                throw new DataValidationError('Invalid "mobile".', {
                    entity: this.meta.name,
                    field: 'mobile'
                });
            }
        }
        if ('mobile' in latest) {
            //Processing "mobile"
            latest.mobile = normalizeMobile(latest.mobile);
        }
        return context;
    }
}

module.exports = db => { User.db = db; return User };
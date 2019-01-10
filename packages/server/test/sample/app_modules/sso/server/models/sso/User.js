const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { isNothing } = require('@k-suite/oolong/lib/utils/lang');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');
const normalizeMobile = require('./processors/user-normalizeMobile.js');
const hashPassword = require('./processors/user-hashPassword.js');

class User extends EntityModel {
    /**
     * Applying predefined modifiers to entity fields.
     * @param context
     * @param isUpdating
     * @returns {*}
     */
    static async applyModifiers_(context, isUpdating) {
        let {raw, latest, existing, i18n} = context;
        existing || (existing = {});
        if (!isNothing(latest['email'])) {
            //Validating "email"
            if (!Validators.isEmail(latest['email'])) {
                throw new DataValidationError('Invalid "email".', {
                    entity: this.meta.name,
                    field: 'email'
                });
            }
        }
        if (!isNothing(latest['password'])) {
            if (isUpdating && isNothing(latest['password'])) {
                throw new DataValidationError('"password" is required due to change of its dependencies. (e.g: passwordSalt)');
            }
            if (!('passwordSalt' in latest) && !('passwordSalt' in existing)) {
                throw new DataValidationError('Missing "passwordSalt" value, which is a dependency of "password".');
            }
            //Processing "password"
            latest['password'] = hashPassword(latest['password'], latest.hasOwnProperty('passwordSalt') ? latest['passwordSalt'] : existing['passwordSalt']);
        }
        if (!isNothing(latest['mobile'])) {
            if (isUpdating && isNothing(latest['mobile'])) {
                throw new DataValidationError('"mobile" is required due to change of its dependencies. (e.g: locale)');
            }
            if (!('locale' in latest) && !('locale' in existing)) {
                throw new DataValidationError('Missing "locale" value, which is a dependency of "mobile".');
            }
            //Validating "mobile"
            if (!Validators.isMobilePhone(latest['mobile'], Processors.stringDasherize(latest.hasOwnProperty('locale') ? latest['locale'] : existing['locale']))) {
                throw new DataValidationError('Invalid "mobile".', {
                    entity: this.meta.name,
                    field: 'mobile'
                });
            }
        }
        if (!isNothing(latest['mobile'])) {
            //Processing "mobile"
            latest['mobile'] = normalizeMobile(latest['mobile']);
        }
        return context;
    }
}

User.meta = {
    "schemaName": "sso",
    "name": "user",
    "keyField": "id",
    "fields": {
        "id": {
            "type": "integer",
            "auto": true,
            "readOnly": true,
            "writeOnce": true,
            "startFrom": 100000,
            "displayName": "Id",
            "autoIncrementId": true,
            "defaultByDb": true
        },
        "email": {
            "type": "text",
            "maxLength": 200,
            "modifiers": [
                {
                    "oolType": "Validator",
                    "name": "isEmail"
                }
            ],
            "comment": "User Email",
            "subClass": [
                "email"
            ],
            "displayName": "User Email",
            "optional": true
        },
        "mobile": {
            "type": "text",
            "maxLength": 20,
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
            "comment": "User Mobile",
            "subClass": [
                "phone"
            ],
            "displayName": "User Mobile",
            "optional": true
        },
        "password": {
            "type": "text",
            "maxLength": 200,
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
            "comment": "User Password",
            "subClass": [
                "password"
            ],
            "displayName": "User Password",
            "defaultByDb": true
        },
        "passwordSalt": {
            "type": "text",
            "fixedLength": 8,
            "auto": true,
            "comment": "User Password Salt",
            "displayName": "User Password Salt"
        },
        "locale": {
            "type": "text",
            "default": "en_AU",
            "comment": "User Locale",
            "displayName": "User Locale"
        },
        "isEmailVerified": {
            "type": "boolean",
            "default": false,
            "displayName": "Is Email Verified"
        },
        "isMobileVerified": {
            "type": "boolean",
            "default": false,
            "displayName": "Is Mobile Verified"
        },
        "status": {
            "type": "enum",
            "values": [
                "inactive",
                "active",
                "disabled",
                "forbidden",
                "deleted"
            ],
            "default": "inactive",
            "comment": "User Status",
            "subClass": [
                "userStatus"
            ],
            "displayName": "User Status"
        },
        "tag": {
            "type": "array",
            "optional": true,
            "displayName": "Tag"
        },
        "createdAt": {
            "type": "datetime",
            "auto": true,
            "readOnly": true,
            "writeOnce": true,
            "displayName": "Created At",
            "isCreateTimestamp": true,
            "defaultByDb": true
        },
        "updatedAt": {
            "type": "datetime",
            "readOnly": true,
            "forceUpdate": true,
            "optional": true,
            "displayName": "Updated At",
            "isUpdateTimestamp": true,
            "updateByDb": true
        },
        "statusInactiveTimestamp": {
            "type": "datetime",
            "readOnly": true,
            "optional": true,
            "auto": true,
            "writeOnce": true,
            "displayName": "Status Inactive Timestamp"
        },
        "statusActiveTimestamp": {
            "type": "datetime",
            "readOnly": true,
            "optional": true,
            "auto": true,
            "writeOnce": true,
            "displayName": "Status Active Timestamp"
        },
        "statusDisabledTimestamp": {
            "type": "datetime",
            "readOnly": true,
            "optional": true,
            "auto": true,
            "writeOnce": true,
            "displayName": "Status Disabled Timestamp"
        },
        "statusForbiddenTimestamp": {
            "type": "datetime",
            "readOnly": true,
            "optional": true,
            "auto": true,
            "writeOnce": true,
            "displayName": "Status Forbidden Timestamp"
        },
        "statusDeletedTimestamp": {
            "type": "datetime",
            "readOnly": true,
            "optional": true,
            "auto": true,
            "writeOnce": true,
            "displayName": "Status Deleted Timestamp"
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

module.exports = db => { User.db = db; return User };
const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { isNothing } = require('@k-suite/oolong/lib/utils/lang');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');


class Profile extends EntityModel {
    /**
     * Applying predefined modifiers to entity fields.
     * @param context
     * @param isUpdating
     * @returns {*}
     */
    static async applyModifiers_(context, isUpdating) {
        let {raw, latest, existing, i18n} = context;
        existing || (existing = {});
        if (!isNothing(latest['avatar'])) {
            //Validating "avatar"
            if (!Validators.isURL(latest['avatar'])) {
                throw new DataValidationError('Invalid "avatar".', {
                    entity: this.meta.name,
                    field: 'avatar'
                });
            }
        }
        if (!isNothing(latest['email'])) {
            //Validating "email"
            if (!Validators.isEmail(latest['email'])) {
                throw new DataValidationError('Invalid "email".', {
                    entity: this.meta.name,
                    field: 'email'
                });
            }
        }
        if (!isNothing(latest['mobile'])) {
            //Validating "mobile"
            if (!Validators.matches(latest['mobile'], '/^((\\+|00)\\d+)?\\d+(-\\d+)?$/')) {
                throw new DataValidationError('Invalid "mobile".', {
                    entity: this.meta.name,
                    field: 'mobile'
                });
            }
        }
        return context;
    }
}

Profile.meta = {
    "schemaName": "sso",
    "name": "profile",
    "keyField": "owner",
    "fields": {
        "firstName": {
            "type": "text",
            "maxLength": 40,
            "optional": true,
            "subClass": [
                "name"
            ],
            "displayName": "First Name"
        },
        "middleName": {
            "type": "text",
            "maxLength": 40,
            "optional": true,
            "subClass": [
                "name"
            ],
            "displayName": "Middle Name"
        },
        "surName": {
            "type": "text",
            "maxLength": 40,
            "optional": true,
            "subClass": [
                "name"
            ],
            "displayName": "Sur Name"
        },
        "dob": {
            "type": "datetime",
            "optional": true,
            "comment": "Date of birth",
            "displayName": "Date of birth"
        },
        "avatar": {
            "type": "text",
            "maxLength": 2000,
            "modifiers": [
                {
                    "oolType": "Validator",
                    "name": "isURL"
                }
            ],
            "optional": true,
            "subClass": [
                "url"
            ],
            "displayName": "Avatar"
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
            "optional": true,
            "subClass": [
                "email"
            ],
            "displayName": "Email"
        },
        "mobile": {
            "type": "text",
            "maxLength": 20,
            "modifiers": [
                {
                    "oolType": "Validator",
                    "name": "matches",
                    "args": [
                        "/^((\\+|00)\\d+)?\\d+(-\\d+)?$/"
                    ]
                }
            ],
            "optional": true,
            "subClass": [
                "phone"
            ],
            "displayName": "Mobile"
        },
        "provider": {
            "type": "text",
            "maxLength": 40,
            "optional": true,
            "subClass": [
                "name"
            ],
            "displayName": "Provider"
        },
        "providerId": {
            "type": "text",
            "maxLength": 100,
            "optional": true,
            "displayName": "Provider Id"
        },
        "owner": {
            "type": "integer",
            "auto": true,
            "readOnly": true,
            "writeOnce": true,
            "startFrom": 100000,
            "displayName": "Id"
        },
        "gender": {
            "type": "text",
            "maxLength": 1,
            "comment": "Gender Code",
            "displayName": "Gender Code",
            "defaultByDb": true
        }
    },
    "indexes": [],
    "features": [],
    "uniqueKeys": [
        [
            "owner"
        ]
    ],
    "fieldDependencies": {
        "mobile": []
    }
};

module.exports = db => { Profile.db = db; return Profile };
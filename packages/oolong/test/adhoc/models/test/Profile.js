const { _ } = require('rk-utils');

//const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const EntityModel = require('../../../../lib/runtime/drivers/mysql/EntityModel');
const { isNothing } = require('../../../../lib/utils/lang');
//const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('../../../../lib/runtime');


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
        return context;
    }
}

Profile.meta = {
    "schemaName": "test",
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
        "gender": {
            "type": "text",
            "maxLength": 1,
            "comment": "Gender Code",
            "displayName": "Gender Code",
            "defaultByDb": true
        },
        "owner": {
            "type": "integer",
            "auto": true,
            "readOnly": true,
            "writeOnce": true,
            "startFrom": 100000,
            "displayName": "Id"
        }
    },
    "indexes": [],
    "features": [],
    "uniqueKeys": [
        [
            "owner"
        ]
    ],
    "fieldDependencies": {}
};

module.exports = db => { Profile.db = db; return Profile };
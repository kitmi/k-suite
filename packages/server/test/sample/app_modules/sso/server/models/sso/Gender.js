const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { isNothing } = require('@k-suite/oolong/lib/utils/lang');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');


class Gender extends EntityModel {
    /**
     * Applying predefined modifiers to entity fields.
     * @param context
     * @param isUpdating
     * @returns {*}
     */
    static async applyModifiers_(context, isUpdating) {
        let {raw, latest, existing, i18n} = context;
        existing || (existing = {});
        return context;
    }
}

Gender.meta = {
    "schemaName": "sso",
    "name": "gender",
    "keyField": "code",
    "fields": {
        "code": {
            "type": "text",
            "maxLength": 1,
            "comment": "Gender Code",
            "displayName": "Gender Code",
            "defaultByDb": true
        },
        "name": {
            "type": "text",
            "maxLength": 20,
            "optional": true,
            "comment": "Gender Name",
            "displayName": "Gender Name"
        }
    },
    "indexes": [],
    "features": [],
    "uniqueKeys": [
        [
            "code"
        ]
    ],
    "fieldDependencies": {}
};

module.exports = db => { Gender.db = db; return Gender };
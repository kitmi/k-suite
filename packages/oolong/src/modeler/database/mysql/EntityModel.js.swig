const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');

class {{ className }} extends EntityModel {
    static meta = {{ entityMeta|safe }};

    {{ classBody }}
}

module.exports = db => { {{ className }}.db = db; return {{ className }} };
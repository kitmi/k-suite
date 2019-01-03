const { _ } = require('rk-utils');

const EntityModel = require('@k-suite/oolong/lib/runtime/drivers/mysql/EntityModel');
const { isNothing } = require('@k-suite/oolong/lib/utils/lang');
const { Validators, Processors, Generators, Errors: { DataValidationError, DsOperationError } } = require('@k-suite/oolong/lib/runtime');
{{ imports|safe }}

class {{ className }} extends EntityModel {
    {{ classBody|safe }}
}

{{ className }}.meta = {{ entityMeta|safe }};

module.exports = db => { {{ className }}.db = db; return {{ className }} };
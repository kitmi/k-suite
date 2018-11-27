const OolTypes = {
    Lang: Object.freeze({
        CONST_REF: 'ConstReference',
        STRING_TMPL: 'StringTemplate',
        VALIDATOR: 'Validator',
        PROCESSOR: 'Processor',
        ACTIVATOR: 'Activator',
        PIPELINE_VAL: 'PipedValue',
        FUNCTION_CALL: 'FunctionCall'
    }),
    Element: Object.freeze({
        CONST: 'constant',
        TYPE: 'type',
        ENTITY: 'entity',
        SCHEMA: 'schema',
        DATASET: 'dataset',
        VIEW: 'view'
    }),
    Relationship: Object.freeze({
        HAS_ONE: 'hasOne',
        HAS_MANY: 'hasMany',        
        BELONGS_TO: 'belongsTo',
        REFERS_TO: 'refersTo'
    }),
    Modifier: Object.freeze({
        VALIDATOR: 'Validator',
        PROCESSOR: 'Processor',
        ACTIVATOR: 'Activator'
    })
};

OolTypes.ModifiersList = Object.values(OolTypes.Modifier);

module.exports = Object.freeze(OolTypes);
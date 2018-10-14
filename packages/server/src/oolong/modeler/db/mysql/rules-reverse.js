"use strict";

const Util = require('../../../../util.js');
const _ = Util._; 

module.exports = {    
    columnTypeConversions: [
        {
            desc: 'Converting field type being "int(11) unsigned" and field name ending with "_time" into "datetime"',
            test: function (table, col) {
                let colName = _.snakeCase(col.COLUMN_NAME);
                return _.endsWith(colName, '_time') && col.COLUMN_TYPE === 'int(11) unsigned';
            },
            apply: function (table, col) {
                return { type: 'datetime' };
            }
        },
        {
            desc: 'Converting field type being "text" and field name ending with "_url" into "url"',
            test: function (table, col) {
                let colName = _.snakeCase(col.COLUMN_NAME);
                return _.endsWith(colName, '_url') && col.COLUMN_TYPE === 'text';
            },
            apply: function (table, col) {
                return { type: 'url' };
            }
        },
        {
            desc: 'Converting field type being "varchar(255)" and field name ending with "_url" into "url"',
            test: function (table, col) {
                let colName = _.snakeCase(col.COLUMN_NAME);
                return _.endsWith(colName, '_url') && col.COLUMN_TYPE === 'varchar(255)';
            },
            apply: function (table, col) {
                return { type: 'url' };
            }
        }
    ]
};
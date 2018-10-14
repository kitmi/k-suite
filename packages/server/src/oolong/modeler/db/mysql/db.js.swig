'use strict';

const Mowa = require('mowa');
const Db = require('mowa/lib/oolong/runtime/db');

class {{ className }}Db extends Db {
    constructor(appModule, ctx) {
        super(appModule, '{{ serviceId }}', ctx);
    }

    model(name) {
        pre: this.constructor.models.indexOf(name) > -1, Mowa.Util.Message.DBC_ELEMENT_NOT_FOUND;

        let Model = require(`./{{ dbName }}/entities/${name}.js`);
        Model.db = this;
        return Model;
    }

    async query_(sql) {
        let conn = await this.conn_();
        return conn.query(sql);
    }
}

{{ className }}Db.models = [{% autoescape false %}{{ models }}{% endautoescape %}];

module.exports = {{ className }}Db;
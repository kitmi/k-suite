const Feature = require('../../../../lib/enum/feature');

module.exports = {
    type: Feature.PLUGIN,

    load_: function (app, options) {
        app.plugin = options.item;
    }
};
const Feature = require('../../../../lib/enum/Feature');

module.exports = {
    type: Feature.INIT,

    load_: function (app, options) {
        app.init = options.item;
    }
};
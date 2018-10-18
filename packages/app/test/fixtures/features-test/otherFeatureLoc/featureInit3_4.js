const Feature = require('../../../../lib/enum/Feature');

module.exports = {

    init3: {
        type: Feature.INIT,

        load_: function (app, info) {
            app.init3 = info;
        }
    },

    init4: {
        type: Feature.INIT,

        load_: function (app, info) {
            app.init4 = info;
        }
    }    
};
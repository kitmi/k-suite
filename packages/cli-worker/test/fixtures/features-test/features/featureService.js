const Feature = require('../../../../lib/enum/feature');

module.exports = {
    type: Feature.SERVICE,

    load_: function (app, options) {
        let service = {
            invoke_: () => {
                return options.item;
            }
        };

        app.registerService('service1', service);
    }
};
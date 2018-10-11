const path = require('path');
const Feature = require('../../../../lib/enum/Feature');

const JsConfigProvider = require('rk-config/lib/JsConfigProvider');

module.exports = {
    type: Feature.CONF,

    load_: async function (app, options) {
        app.configLoader.provider = new JsConfigProvider(path.join(app.configPath, 'app-override.js'));
        
        return app.loadConfig_();
    }
};
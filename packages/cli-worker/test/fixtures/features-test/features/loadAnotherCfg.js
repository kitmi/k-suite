const path = require('path');
const Literal = require('../../../../lib/enum/Literal');
const Feature = require('../../../../lib/enum/feature');

const JsConfigProvider = require('rk-config/lib/JsConfigProvider');

module.exports = {
    type: Feature.CONF,

    load_: async function (app, options) {
        app.configLoader.provider = new JsConfigProvider(path.join(app.configPath, 'app-override.js'));
        app.config = await app.configLoader.load_();
    }
};
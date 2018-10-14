"use strict";

/**
 * @module Feature_I18n
 * @summary Internationalization service
 */

const Mowa = require('../server.js');
const Feature = require('../enum/feature');
const Util = Mowa.Util;
const Promise = Util.Promise;
const _ = Util._;

const I18n = require('../oolong/runtime/i18n');

const DEFAULT_LOCALE = 'en_AU';
const DEFAULT_PRECEDENCE = ['query', 'cookie', 'header'];

/**
 * 1. Register an i18n service
 * 2. Use i18n middleware before any other middleware
 * 3. Add requestedLocale at middleware context
 */

class I18nStorage {
    static get file() { return I18n.File; }
}

class I18nService {
    constructor(Handler, options) {
        this.HandlerClass = Handler;
        this.options = options;
        this.cache = Util.createLRUCache(5);
        this.defaultLocale = this.options.defaultLocale || DEFAULT_LOCALE;
    }

    async getI18n(locale) {

        let i18nHandler = locale && this.cache.get(locale);

        if (!i18nHandler) {
            i18nHandler = new (this.HandlerClass)(this.options);

            if (!locale || !i18nHandler.isLocaleSupported(locale)) {
                locale = this.defaultLocale;

                let defaultHandler = this.cache.get(locale);
                if (defaultHandler) {
                    return Promise.resolve(defaultHandler);
                }
            }

            await i18nHandler.setupAsync(locale);

            this.cache.set(locale, i18nHandler);
        }

        return i18nHandler;
    }
}

module.exports = {

    /**
     * This feature is loaded at service stage
     * @member {string}
     */
    type: Feature.SERVICE,

    /**
     * Load the feature
     * @param {AppModule} appModule - The app module object
     * @param {object} config - Configuration for the feature
     * @property {string} config.store - The storage type
     * @property {Object} config.options - Options for the storage type
     * @property {Array.<string>} config.precedence - Precedence of the source of locale id, candidate sources are like 'query', 'cookie', 'header'
     * @property {string} [config.defaultLocale=DEFAULT_LOCALE] - The default locale of this app
     * @property {string} [config.queryKey='locale'] - The key of locale id in a http request query, default: locale
     * @property {string} [config.cookieKey='locale'] - The key of locale id in the cookie, default: locale
     * @returns {Promise.<*>}
     */
    load_: async (appModule, config) => {
        if (!config.store) {
            throw new Mowa.Error.InvalidConfiguration('Missing store type.', appModule, 'i18n.store');
        }

        let Storage = I18nStorage[config.store];

        if (!Storage) {
            throw new Mowa.Error.InvalidConfiguration('Unsupported store type.', appModule, 'i18n.store');
        }

        let options;

        if (config.store === 'file') {
            options = Object.assign({}, {directory: Mowa.Literal.LOCALE_PATH}, config.options);
        }

        let service = new I18nService(Storage, options);

        let precedence = _.isEmpty(config.precedence) ? ['query', 'cookie', 'header'] : config.precedence;
        let queryKey = config.queryKey || 'locale';
        let cookieKey = config.cookieKey || 'locale';

        precedence.forEach(p => {
            if (DEFAULT_PRECEDENCE.indexOf(p) === -1) {
                throw new Mowa.Error.InvalidConfiguration('Unknown locale id source: ' + source, appModule, 'i18n.precedence');
            }
        });

        let i18nMiddleware = async (ctx, next) => {            
            let locale;
            let found = precedence.some(source => {
                switch (source) {
                    case 'query':
                        locale = ctx.query[queryKey];
                        break;

                    case 'cookie':
                        locale = ctx.cookies.get(cookieKey);
                        break;

                    case 'header':
                        let accept = ctx.acceptsLanguages() || '',
                            reg = /(^|,\s*)([a-z-]+)/gi,
                            match, l;

                        while ((match = reg.exec(accept))) {
                            if (!l) {
                                l = match[2];
                            }
                        }

                        locale = l;
                        break;
                }

                return !_.isEmpty(locale);
            });

            if (found) ctx.requestedLocale = I18n.normalizeLocale(locale);

            ctx.__ = await service.getI18n(ctx.requestedLocale);

            await next();
        };

        appModule.__ = await service.getI18n();
        appModule.registerService('i18n', service);

        appModule.router.use(i18nMiddleware);
    }
};
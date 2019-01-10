"use strict";

const { _ } = require('rk-utils');
const Strategy = require('passport-strategy');

class LocalStrategy extends Strategy {
    constructor(app) {
        super();

        this.app = app;
        this.name = 'local';
    }

    authenticate(req, options) {
        if (_.isEmpty(req.body)) {
            return this.fail({ message: options.badRequestMessage || 'Invalid arguments' }, 400);
        }

        let username = req.body.username;
        let password = req.body.password;

        if (!username || !password) {
            return this.fail({ message: options.badRequestMessage || 'Missing credentials' }, 400);
        }

        const verified = (err, user, info) => {
            if (err) { return this.error(err); }
            if (!user) { return this.fail(info); }
            this.success(user, info);
        };

        try {
            let db = this.app.db('sso');
            let User = db.model('user');

            User.findOne_({ email: username }).then(user => {                 
                return verified(null, user);
            }).catch(error => {
                return verified(error, false);
            });            
        } catch (ex) {
            return this.error(ex);
        }
    }
}

/**
 * Strategy initiator
 * @param {AppModule} app 
 * @param {*} passport 
 */
module.exports = (app, passport) => {
    //serializeUser and deserializeUser are used only when session is enabled

    //called after login
    passport.serializeUser((req, user, done) => {
        done(null, user.id);
    });

    //called if session has user
    passport.deserializeUser((req, id, done) => {

        try {
            const db = app.db('sso');
            const User = db.model('user');        
            
            User.findOne_(id).then(user => {
                if (!user) {
                    done(null, false);
                } else {                    
                    done(null, user);
                }
            }).catch(error => {
                done(error);
            });
        } catch (ex) {
            done(ex);
        }
    });

    passport.use(new LocalStrategy(app));
};
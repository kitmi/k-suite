'use strict';

const { fs, runCmdSync, _ } = require('rk-utils');
const path = require('path');
const winston = require('winston');
const WORKING_FOLDER = path.resolve(__dirname, 'dao');
const OOLONG_CLI = 'node ../../lib/cli/oolong.js';

describe('e2e:oolong:dao:useOol', function () {
    let logger = winston.createLogger({
        "level": "debug",
        "transports": [
            new winston.transports.Console({                            
                "format": winston.format.combine(winston.format.colorize(), winston.format.simple())
            })
        ]
    });

    let cfg;

    before(function () {        
        process.chdir(WORKING_FOLDER);
        fs.removeSync(path.join(WORKING_FOLDER, 'models'));

        cfg = fs.readJsonSync('./oolong-ool.json', 'utf8');
    });

    after(function () {
        fs.removeSync(path.join(WORKING_FOLDER, 'oolong-cli.log'));
        fs.removeSync(path.join(WORKING_FOLDER, 'models'));
    });

    it('build', function () {
        let output = runCmdSync(OOLONG_CLI + ' build -c oolong-ool.json');
        
        output.should.match(/Generated entity model/);
    });

    it('migrate', function () {
        let output = runCmdSync(OOLONG_CLI + ' migrate -c oolong-ool.json -r');
        
        output.should.match(/Database scripts ".+?" run successfully/);
    });    

    it('get model', async function () {
        const Db = require(path.resolve('./models/Test'));
        should.exists(Db);
        Db.should.have.keys('driver', 'schemaName');
        Db.driver.should.be.equal('mysql');
        Db.schemaName.should.be.equal('test');

        let db = new Db(cfg.mysql.fooBar.connection);
        should.exists(db.connector);

        let User = db.model('user');  
        let User2 = db.model('User');  
        should.exists(User);
        should.exists(User2);

        User.should.be.equal(User2);
        await db.close_();
    });

    it('find all from db', async function () {
        const Db = require(path.resolve('./models/Test'));        
        let db = new Db(cfg.mysql.fooBar.connection);

        let User = db.model('user');  

        let result = await User.findAll_();        
        Array.isArray(result).should.be.ok();
        result.length.should.be.exactly(1);

        let user = result[0];
        user.email.should.be.equal('admin@email.com');

        await db.close_();
    });

    it('insert and find', async function () {
        const Db = require(path.resolve('./models/Test'));        
        let db = new Db(cfg.mysql.fooBar.connection, { logger, logSQLStatement: true });

        let User = db.model('user');  
        let saved = await User.create_({
            email: 'abc@gefg.hij',
            mobile: '0423456789',
            password: '123456'
        });        
        saved.should.have.keys('id', 'email', 'mobile', 'password', 'passwordSalt', 'locale', 'status', 'createdAt', 'statusInactiveTimestamp');

        let result = await User.findAll_({email: 'abc@gefg.hij'});
        Array.isArray(result).should.be.ok();
        result.length.should.be.exactly(1);

        let savedUser = result[0];
        savedUser.should.have.keys('id', 'email', 'mobile', 'password', 'passwordSalt', 'locale', 'status', 'createdAt', 'updatedAt', 'statusInactiveTimestamp');

        savedUser.email.should.be.equal(saved.email);
        savedUser.mobile.should.be.equal(saved.mobile);
        should.not.exist(savedUser.updatedAt);

        await User.delete_({ $where: savedUser.id, $physicalDeletion: true });

        await db.close_();
    });

    it('updates', async function () {
        const Db = require(path.resolve('./models/Test'));        
        let db = new Db(cfg.mysql.fooBar.connection, { logger, logSQLStatement: true });

        let User = db.model('user');  
        let created = await User.create_({
            email: 'abc@gefg.hij',
            mobile: '0423456789',
            password: '123456'
        });        

        let user = await User.update_({ mobile: '0423456000' }, { email: 'abc@gefg.hij' });

        Object.keys(user).length.should.be.exactly(1);
        user.mobile.should.be.equal('0423456000');

        user = await User.update_({ password: '123457' }, { $where: { email: 'abc@gefg.hij' }, $retrieveUpdated: true });
        user.password.should.be.equal('123457');
        user.should.have.keys('email', 'mobile');
        user.mobile.should.be.equal('0423456000');

        user = await User.update_({ status: 'active' }, { email: 'abc@gefg.hij' });        
        Object.keys(user).length.should.be.exactly(2);
        
        user.status.should.be.equal('active');

        await User.delete_({ $where: created.id, $physicalDeletion: true });

        await db.close_();
    });

    it('all null with atLeastOneNotNull during creating', async function () {
        const Db = require(path.resolve('./models/Test'));        
        let db = new Db(cfg.mysql.fooBar.connection, { logger, logSQLStatement: true });

        let User = db.model('user');  

        try {
            await User.create_({            
                password: '123456'
            });
        } catch (error) {            
            error.message.should.be.equal('At least one of these fields "email", "mobile" should not be null.');
        }

        await db.close_();
    });

    it('all null with atLeastOneNotNull during updating', async function () {
        const Db = require(path.resolve('./models/Test'));        
        let db = new Db(cfg.mysql.fooBar.connection, { logger, logSQLStatement: true });

        let User = db.model('user');  

        await User.delete_({ $where: { mobile: '0423456001' }, $physicalDeletion: true });

        let user = await User.create_({                        
            mobile: '0423456001',
            password: '123456'
        });


        try {
            await User.update_({ mobile: null }, user.id); 
        } catch (error) {  
            error.message.should.be.equal('At least one of these fields "email", "mobile" should not be null.');
        }

        await db.close_();
    });
});
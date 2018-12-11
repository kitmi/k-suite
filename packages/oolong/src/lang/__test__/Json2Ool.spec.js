'use strict';

const { fs } = require('rk-utils');
const path = require('path');
const winston = require('winston');

const SOURCE_PATH = path.resolve(__dirname, '../../../test/unitOolGen');
const ENT_SOURCE_PATH = path.join(SOURCE_PATH, 'entities');
const OolCodeGen = require('../../../lib/lang/OolCodeGen');
const Linker = require('../../../lib/lang/Linker');

describe('unit:lang:OolCodeGen', function () {    
    let logger = winston.createLogger({
        "level": "info",
        "transports": [
            new winston.transports.Console({                            
                "format": winston.format.combine(winston.format.colorize(), winston.format.simple())
            })
        ]
    });

    it('Generate entities', function () {        
        let entitiesPath = path.join(ENT_SOURCE_PATH);
        let files = fs.readdirSync(entitiesPath);

        files.forEach(f => {
            if (f.endsWith('.json')) {
                let json = fs.readJsonSync(path.join(ENT_SOURCE_PATH, f), 'utf8') //linker.loadModule(f);
                
                let content = OolCodeGen.transform(json);
                fs.writeFileSync(path.join(entitiesPath, f.substr(0, f.length - 5)), content, 'utf8');
            }
        });        
    });

    it('Linking from generated', function () {
        let linker = new Linker({ logger, dslSourcePath: SOURCE_PATH });
        linker.link('test.ool');

        linker.schemas.should.have.keys('test');
        linker.schemas.test.entities.should.have.keys('user', 'profile', 'gender', 'group', 'usergroup');
    });
});
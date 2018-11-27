require("@babel/register")({
    "presets": [
      ["@babel/env", {                
        "targets": {     
          "node": "8.11.4"
        }
      }]
    ],
    "ignore": [
        "src/lang/grammar/oolong.js"
    ],
    "plugins": [    
      ["@babel/plugin-proposal-decorators", {"legacy": true}]
    ]
  });

const fs = require('fs');
const OolongParser = require('./oolong').parser;

let ool = OolongParser.parse(fs.readFileSync('src/lang/grammar/sample.ool', 'utf8'));
fs.writeFileSync('src/lang/grammar/sample.json', JSON.stringify(ool, null, 4), { encoding: 'utf8' });
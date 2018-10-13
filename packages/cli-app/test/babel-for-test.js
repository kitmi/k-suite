require("@babel/register")({
  "presets": [
    ["@babel/env", {                
      "targets": {     
        "node": "8.11.4"
      }
    }]
  ],
  "plugins": [    
    ["@babel/plugin-proposal-decorators", {"legacy": true}]
  ]
});
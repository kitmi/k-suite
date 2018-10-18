module.exports = function (api) {  
  let isProduction = api.env(["production"]); 

  return {
    "presets": [
      [
        "@babel/env",
        {      
          "targets": {     
            "node": "8.11.4"
          }
        }
      ]
    ],
    "comments": false,
    ...(isProduction ? {
      "minified": true
    }: {}),  
    "ignore": [
      "src/**/*.spec.js"
    ], 
    "plugins": [
      ["contract", {
        "strip": isProduction,
        "names": {
          "assert": "assert",
          "precondition": "pre",
          "postcondition": "post",
          "invariant": "invariant",
          "return": "it"
        }
      }],      
      ["@babel/plugin-proposal-decorators", {"legacy": true}],
      ["@babel/plugin-proposal-class-properties", { "loose": true }]
    ]
  };
}
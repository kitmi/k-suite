module.exports = function (api) {  
  let isProdAndTest = api.env(["production"]); // api.env(["production", "test"]);

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
    ...(isProdAndTest ? {
      "minified": true
    }: {}),
    "ignore": [
      "src/oolong/lang/oolong.js"
    ],
    "plugins": [
      ["contract", {
        "strip": isProdAndTest,
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
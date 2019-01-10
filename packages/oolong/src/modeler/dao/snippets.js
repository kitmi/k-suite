"use strict";

const { _, quote } = require('rk-utils');
const { extractDotSeparateName } = require('../../lang/OolUtils');
const JsLang = require('../util/ast');

const _applyModifiersHeader = [   
    {
        "type": "VariableDeclaration",
        "declarations": [
            {
                "type": "VariableDeclarator",
                "id": {
                    "type": "ObjectPattern",
                    "properties": [
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "raw"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "raw"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        },
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "latest"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "latest"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        },
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "existing"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "existing"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        },
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "i18n"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "i18n"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        }
                    ]
                },
                "init": {
                    "type": "Identifier",
                    "name": "context"
                }
            }
        ],
        "kind": "let"
    },{
        "type": "ExpressionStatement",
        "expression": {
            "type": "LogicalExpression",
            "operator": "||",
            "left": {
                "type": "Identifier",
                "name": "existing"
            },
            "right": {
                "type": "AssignmentExpression",
                "operator": "=",
                "left": {
                    "type": "Identifier",
                    "name": "existing"
                },
                "right": {
                    "type": "ObjectExpression",
                    "properties": []
                }
            }
        }
    }];

const _validateCheck = (fieldName, validatingCall) => { 
    let comment = `Validating "${fieldName}"`;

    return {
        "type": "IfStatement",
        "test": {
            "type": "UnaryExpression",
            "operator": "!",
            "argument": validatingCall,
            "prefix": true
        },
        "consequent": {
            "type": "BlockStatement",
            "body": [
                {
                    "type": "ThrowStatement",
                    "argument": {
                        "type": "NewExpression",
                        "callee": {
                            "type": "Identifier",
                            "name": "DataValidationError"
                        },
                        "arguments": [
                            {
                                "type": "Literal",
                                "value": `Invalid "${fieldName}".`,
                                "raw": `'Invalid "${fieldName}".'`
                            },
                            {
                                "type": "ObjectExpression",
                                "properties": [
                                    {
                                        "type": "Property",
                                        "key": {
                                            "type": "Identifier",
                                            "name": "entity"
                                        },
                                        "computed": false,
                                        "value": {
                                            "type": "MemberExpression",
                                            "computed": false,
                                            "object": {
                                                "type": "MemberExpression",
                                                "computed": false,
                                                "object": {
                                                    "type": "ThisExpression"
                                                },
                                                "property": {
                                                    "type": "Identifier",
                                                    "name": "meta"
                                                }
                                            },
                                            "property": {
                                                "type": "Identifier",
                                                "name": "name"
                                            }
                                        },
                                        "kind": "init",
                                        "method": false,
                                        "shorthand": false
                                    },
                                    {
                                        "type": "Property",
                                        "key": {
                                            "type": "Identifier",
                                            "name": "field"
                                        },
                                        "computed": false,
                                        "value": JsLang.astValue(fieldName),
                                        "kind": "init",
                                        "method": false,
                                        "shorthand": false
                                    }
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "alternate": null,
        "leadingComments": [
            {
                "type": "Line",
                "value": comment,
                "range": [
                    1,
                    comment.length+1
                ]
            }
        ]
    };
};

function buildTest(conditions) {
    if (conditions.length === 0) return null;

    let c = conditions.pop();

    if (conditions.length === 0) {
        return {
            "type": "BinaryExpression",
            "operator": "in",
            "left": {
                "type": "Literal",
                "value": c,
                "raw": quote(c, "'")
            },
            "right": {
                "type": "Identifier",
                "name": "latest"
            }
        }
    } 

    return {
        "type": "LogicalExpression",
        "operator": "||",
        "left": buildTest(conditions),
        "right": {
            "type": "BinaryExpression",
            "operator": "in",
            "left": {
                "type": "Literal",
                "value": c,
                "raw": quote(c, "'")
            },
            "right": {
                "type": "Identifier",
                "name": "latest"
            }
        }
    };
}

/**
 * Check existence of all required fields
 * @param {string} fieldName - Target field name
 * @param {*} references - All references to other fields 
 * @param {*} content - Content code block
 * @param {bool} requireTargetField - Whether the function requires target field as input
 */
const _fieldRequirementCheck = (fieldName, references, content, requireTargetField) => { 
    if (!references) references = [];

    references = references.map(ref => extractDotSeparateName(ref).pop());

    //let test = buildTest(_.reverse((requireTargetField ? [fieldName] : []).concat(references)));
    //let test = requireTargetField && buildTest([fieldName]);

    let throwMessage = `"${fieldName}" is required due to change of its dependencies. (e.g: ${references.join(' or ')})`;

    let checks = (requireTargetField && references.length > 0) ? [
        {
            "type": "IfStatement",
            "test": {
                "type": "LogicalExpression",
                "operator": "&&",
                "left": {
                    "type": "Identifier",
                    "name": "isUpdating"
                },
                "right": {
                    "type": "CallExpression",
                    "callee": {
                        "type": "Identifier",
                        "name": "isNothing"
                    },
                    "arguments": [
                        {
                            "type": "MemberExpression",
                            "computed": true,
                            "object": {
                                "type": "Identifier",
                                "name": "latest"
                            },
                            "property": {
                                "type": "Literal",
                                "value": fieldName,
                                "raw": quote(fieldName, "'")
                            }
                        }
                    ]
                }                
            },
            "consequent": {
                "type": "BlockStatement",
                "body": [
                    {
                        "type": "ThrowStatement",
                        "argument": {
                            "type": "NewExpression",
                            "callee": {
                                "type": "Identifier",
                                "name": "DataValidationError"
                            },
                            "arguments": [
                                {
                                    "type": "Literal",
                                    "value": throwMessage,
                                    "raw": quote(throwMessage, "'")
                                }
                            ]
                        }
                    }
                ]
            },
            "alternate": null
        }
    ] : [];

    references.forEach(ref => {
        let refThrowMessage = `Missing "${ref}" value, which is a dependency of "${fieldName}".`;

        checks.push({
            "type": "IfStatement",
            "test": {
                "type": "LogicalExpression",
                "operator": "&&",
                "left": {
                    "type": "UnaryExpression",
                    "operator": "!",
                    "argument": {
                        "type": "BinaryExpression",
                        "operator": "in",
                        "left": {
                            "type": "Literal",
                            "value": ref,
                            "raw": quote(ref, "'")
                        },
                        "right": {
                            "type": "Identifier",
                            "name": "latest"
                        }
                    },
                    "prefix": true
                },
                "right": {
                    "type": "UnaryExpression",
                    "operator": "!",
                    "argument": {
                        "type": "BinaryExpression",
                        "operator": "in",
                        "left": {
                            "type": "Literal",
                            "value": ref,
                            "raw": quote(ref, "'")
                        },
                        "right": {
                            "type": "Identifier",
                            "name": "existing"
                        }
                    },
                    "prefix": true
                }                    
            },
            "consequent": {
                "type": "BlockStatement",
                "body": [
                    {
                        "type": "ThrowStatement",
                        "argument": {
                            "type": "NewExpression",
                            "callee": {
                                "type": "Identifier",
                                "name": "DataValidationError"
                            },
                            "arguments": [
                                {
                                    "type": "Literal",
                                    "value": refThrowMessage,
                                    "raw": quote(refThrowMessage, "'")
                                }
                            ]
                        }
                    }
                ]
            },
            "alternate": null
        });
    });
    
    return requireTargetField ? {
        "type": "IfStatement",
        "test": {
            "type": "UnaryExpression",
            "operator": "!",
            "argument": {
                "type": "CallExpression",
                "callee": {
                    "type": "Identifier",
                    "name": "isNothing"
                },
                "arguments": [
                    {
                        "type": "MemberExpression",
                        "computed": true,
                        "object": {
                            "type": "Identifier",
                            "name": "latest"
                        },
                        "property": {
                            "type": "Literal",
                            "value": fieldName,
                            "raw": quote(fieldName, "'")
                        }
                    }
                ]
            },
            "prefix": true
        },
        "consequent": {
            "type": "BlockStatement",
            "body": checks.concat(content)
        },
        "alternate": null
    } : checks.concat(content);
};

const restMethods = (serviceId, entityName, className) => ({
    "type": "Program",
    "body": [
        {
            "type": "ExpressionStatement",
            "expression": {
                "type": "Literal",
                "value": "use strict",
                "raw": "\"use strict\""
            },
            "directive": "use strict"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "Mowa"
                    },
                    "init": {
                        "type": "CallExpression",
                        "callee": {
                            "type": "Identifier",
                            "name": "require"
                        },
                        "arguments": [
                            {
                                "type": "Literal",
                                "value": "mowa",
                                "raw": "'mowa'"
                            }
                        ]
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "dbId"
                    },
                    "init": {
                        "type": "Literal",
                        "value": serviceId,
                        "raw": `'${serviceId}'`
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "modelName"
                    },
                    "init": {
                        "type": "Literal",
                        "value": entityName,
                        "raw": `'${entityName}'`
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "query"
                    },
                    "init": {
                        "type": "ArrowFunctionExpression",
                        "id": null,
                        "params": [
                            {
                                "type": "Identifier",
                                "name": "ctx"
                            }
                        ],
                        "body": {
                            "type": "BlockStatement",
                            "body": [
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "db"
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": "ctx"
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "appModule"
                                                        }
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "dbId"
                                                    },
                                                    {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": className
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "model"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "modelName"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "ReturnStatement",
                                    "argument": {
                                        "type": "CallExpression",
                                        "callee": {
                                            "type": "MemberExpression",
                                            "computed": false,
                                            "object": {
                                                "type": "Identifier",
                                                "name": className
                                            },
                                            "property": {
                                                "type": "Identifier",
                                                "name": "find"
                                            }
                                        },
                                        "arguments": [
                                            {
                                                "type": "MemberExpression",
                                                "computed": false,
                                                "object": {
                                                    "type": "Identifier",
                                                    "name": "ctx"
                                                },
                                                "property": {
                                                    "type": "Identifier",
                                                    "name": "query"
                                                }
                                            },
                                            {
                                                "type": "Literal",
                                                "value": true,
                                                "raw": "true"
                                            }
                                        ]
                                    }
                                }
                            ]
                        },
                        "generator": false,
                        "expression": false,
                        "async": true
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "detail"
                    },
                    "init": {
                        "type": "ArrowFunctionExpression",
                        "id": null,
                        "params": [
                            {
                                "type": "Identifier",
                                "name": "ctx"
                            }
                        ],
                        "body": {
                            "type": "BlockStatement",
                            "body": [
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "id"
                                            },
                                            "init": {
                                                "type": "MemberExpression",
                                                "computed": false,
                                                "object": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "params"
                                                    }
                                                },
                                                "property": {
                                                    "type": "Identifier",
                                                    "name": "id"
                                                }
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "db"
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": "ctx"
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "appModule"
                                                        }
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "dbId"
                                                    },
                                                    {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": className
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "model"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "modelName"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": entityName
                                            },
                                            "init": {
                                                "type": "AwaitExpression",
                                                "argument": {
                                                    "type": "CallExpression",
                                                    "callee": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": className
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "findOne"
                                                        }
                                                    },
                                                    "arguments": [
                                                        {
                                                            "type": "Identifier",
                                                            "name": "id"
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "IfStatement",
                                    "test": {
                                        "type": "UnaryExpression",
                                        "operator": "!",
                                        "argument": {
                                            "type": "Identifier",
                                            "name": entityName
                                        },
                                        "prefix": true
                                    },
                                    "consequent": {
                                        "type": "BlockStatement",
                                        "body": [
                                            {
                                                "type": "ReturnStatement",
                                                "argument": {
                                                    "type": "ObjectExpression",
                                                    "properties": [
                                                        {
                                                            "type": "Property",
                                                            "key": {
                                                                "type": "Identifier",
                                                                "name": "error"
                                                            },
                                                            "computed": false,
                                                            "value": {
                                                                "type": "Literal",
                                                                "value": "record_not_found",
                                                                "raw": "'record_not_found'"
                                                            },
                                                            "kind": "init",
                                                            "method": false,
                                                            "shorthand": false
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    },
                                    "alternate": null
                                },
                                {
                                    "type": "ReturnStatement",
                                    "argument": {
                                        "type": "MemberExpression",
                                        "computed": false,
                                        "object": {
                                            "type": "Identifier",
                                            "name": entityName
                                        },
                                        "property": {
                                            "type": "Identifier",
                                            "name": "data"
                                        }
                                    }
                                }
                            ]
                        },
                        "generator": false,
                        "expression": false,
                        "async": true
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "create"
                    },
                    "init": {
                        "type": "ArrowFunctionExpression",
                        "id": null,
                        "params": [
                            {
                                "type": "Identifier",
                                "name": "ctx"
                            }
                        ],
                        "body": {
                            "type": "BlockStatement",
                            "body": [
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "db"
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": "ctx"
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "appModule"
                                                        }
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "dbId"
                                                    },
                                                    {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": className
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "model"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "modelName"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": entityName
                                            },
                                            "init": {
                                                "type": "NewExpression",
                                                "callee": {
                                                    "type": "Identifier",
                                                    "name": className
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "MemberExpression",
                                                            "computed": false,
                                                            "object": {
                                                                "type": "Identifier",
                                                                "name": "ctx"
                                                            },
                                                            "property": {
                                                                "type": "Identifier",
                                                                "name": "request"
                                                            }
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "fields"
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "ReturnStatement",
                                    "argument": {
                                        "type": "MemberExpression",
                                        "computed": false,
                                        "object": {
                                            "type": "AwaitExpression",
                                            "argument": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": entityName
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "save"
                                                    }
                                                },
                                                "arguments": []
                                            }
                                        },
                                        "property": {
                                            "type": "Identifier",
                                            "name": "data"
                                        }
                                    }
                                }
                            ]
                        },
                        "generator": false,
                        "expression": false,
                        "async": true
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "update"
                    },
                    "init": {
                        "type": "ArrowFunctionExpression",
                        "id": null,
                        "params": [
                            {
                                "type": "Identifier",
                                "name": "ctx"
                            }
                        ],
                        "body": {
                            "type": "BlockStatement",
                            "body": [
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "id"
                                            },
                                            "init": {
                                                "type": "MemberExpression",
                                                "computed": false,
                                                "object": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "params"
                                                    }
                                                },
                                                "property": {
                                                    "type": "Identifier",
                                                    "name": "id"
                                                }
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "db"
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": "ctx"
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "appModule"
                                                        }
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "dbId"
                                                    },
                                                    {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": className
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "model"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "modelName"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": entityName
                                            },
                                            "init": {
                                                "type": "AwaitExpression",
                                                "argument": {
                                                    "type": "CallExpression",
                                                    "callee": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": className
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "findOne"
                                                        }
                                                    },
                                                    "arguments": [
                                                        {
                                                            "type": "Identifier",
                                                            "name": "id"
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "IfStatement",
                                    "test": {
                                        "type": "Identifier",
                                        "name": entityName
                                    },
                                    "consequent": {
                                        "type": "BlockStatement",
                                        "body": [
                                            {
                                                "type": "ExpressionStatement",
                                                "expression": {
                                                    "type": "CallExpression",
                                                    "callee": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": "Object"
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "assign"
                                                        }
                                                    },
                                                    "arguments": [
                                                        {
                                                            "type": "MemberExpression",
                                                            "computed": false,
                                                            "object": {
                                                                "type": "Identifier",
                                                                "name": entityName
                                                            },
                                                            "property": {
                                                                "type": "Identifier",
                                                                "name": "data"
                                                            }
                                                        },
                                                        {
                                                            "type": "MemberExpression",
                                                            "computed": false,
                                                            "object": {
                                                                "type": "MemberExpression",
                                                                "computed": false,
                                                                "object": {
                                                                    "type": "Identifier",
                                                                    "name": "ctx"
                                                                },
                                                                "property": {
                                                                    "type": "Identifier",
                                                                    "name": "request"
                                                                }
                                                            },
                                                            "property": {
                                                                "type": "Identifier",
                                                                "name": "fields"
                                                            }
                                                        }
                                                    ]
                                                }
                                            },
                                            {
                                                "type": "ReturnStatement",
                                                "argument": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "AwaitExpression",
                                                        "argument": {
                                                            "type": "CallExpression",
                                                            "callee": {
                                                                "type": "MemberExpression",
                                                                "computed": false,
                                                                "object": {
                                                                    "type": "Identifier",
                                                                    "name": entityName
                                                                },
                                                                "property": {
                                                                    "type": "Identifier",
                                                                    "name": "save"
                                                                }
                                                            },
                                                            "arguments": []
                                                        }
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "data"
                                                    }
                                                }
                                            }
                                        ]
                                    },
                                    "alternate": null
                                },
                                {
                                    "type": "ReturnStatement",
                                    "argument": {
                                        "type": "ObjectExpression",
                                        "properties": [
                                            {
                                                "type": "Property",
                                                "key": {
                                                    "type": "Identifier",
                                                    "name": "error"
                                                },
                                                "computed": false,
                                                "value": {
                                                    "type": "Literal",
                                                    "value": "record_not_found",
                                                    "raw": "'record_not_found'"
                                                },
                                                "kind": "init",
                                                "method": false,
                                                "shorthand": false
                                            }
                                        ]
                                    }
                                }
                            ]
                        },
                        "generator": false,
                        "expression": false,
                        "async": true
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "VariableDeclaration",
            "declarations": [
                {
                    "type": "VariableDeclarator",
                    "id": {
                        "type": "Identifier",
                        "name": "remove"
                    },
                    "init": {
                        "type": "ArrowFunctionExpression",
                        "id": null,
                        "params": [
                            {
                                "type": "Identifier",
                                "name": "ctx"
                            }
                        ],
                        "body": {
                            "type": "BlockStatement",
                            "body": [
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "id"
                                            },
                                            "init": {
                                                "type": "MemberExpression",
                                                "computed": false,
                                                "object": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "params"
                                                    }
                                                },
                                                "property": {
                                                    "type": "Identifier",
                                                    "name": "id"
                                                }
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": "db"
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "MemberExpression",
                                                        "computed": false,
                                                        "object": {
                                                            "type": "Identifier",
                                                            "name": "ctx"
                                                        },
                                                        "property": {
                                                            "type": "Identifier",
                                                            "name": "appModule"
                                                        }
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "dbId"
                                                    },
                                                    {
                                                        "type": "Identifier",
                                                        "name": "ctx"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "VariableDeclaration",
                                    "declarations": [
                                        {
                                            "type": "VariableDeclarator",
                                            "id": {
                                                "type": "Identifier",
                                                "name": className
                                            },
                                            "init": {
                                                "type": "CallExpression",
                                                "callee": {
                                                    "type": "MemberExpression",
                                                    "computed": false,
                                                    "object": {
                                                        "type": "Identifier",
                                                        "name": "db"
                                                    },
                                                    "property": {
                                                        "type": "Identifier",
                                                        "name": "model"
                                                    }
                                                },
                                                "arguments": [
                                                    {
                                                        "type": "Identifier",
                                                        "name": "modelName"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "kind": "let"
                                },
                                {
                                    "type": "ExpressionStatement",
                                    "expression": {
                                        "type": "AwaitExpression",
                                        "argument": {
                                            "type": "CallExpression",
                                            "callee": {
                                                "type": "MemberExpression",
                                                "computed": false,
                                                "object": {
                                                    "type": "Identifier",
                                                    "name": className
                                                },
                                                "property": {
                                                    "type": "Identifier",
                                                    "name": "removeOne"
                                                }
                                            },
                                            "arguments": [
                                                {
                                                    "type": "Identifier",
                                                    "name": "id"
                                                }
                                            ]
                                        }
                                    }
                                },
                                {
                                    "type": "ReturnStatement",
                                    "argument": {
                                        "type": "ObjectExpression",
                                        "properties": [
                                            {
                                                "type": "Property",
                                                "key": {
                                                    "type": "Identifier",
                                                    "name": "status"
                                                },
                                                "computed": false,
                                                "value": {
                                                    "type": "Literal",
                                                    "value": "ok",
                                                    "raw": "'ok'"
                                                },
                                                "kind": "init",
                                                "method": false,
                                                "shorthand": false
                                            }
                                        ]
                                    }
                                }
                            ]
                        },
                        "generator": false,
                        "expression": false,
                        "async": true
                    }
                }
            ],
            "kind": "const"
        },
        {
            "type": "ExpressionStatement",
            "expression": {
                "type": "AssignmentExpression",
                "operator": "=",
                "left": {
                    "type": "MemberExpression",
                    "computed": false,
                    "object": {
                        "type": "Identifier",
                        "name": "module"
                    },
                    "property": {
                        "type": "Identifier",
                        "name": "exports"
                    }
                },
                "right": {
                    "type": "ObjectExpression",
                    "properties": [
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "query"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "query"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        },
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "detail"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "detail"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        },
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "create"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "create"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        },
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "update"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "update"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        },
                        {
                            "type": "Property",
                            "key": {
                                "type": "Identifier",
                                "name": "remove"
                            },
                            "computed": false,
                            "value": {
                                "type": "Identifier",
                                "name": "remove"
                            },
                            "kind": "init",
                            "method": false,
                            "shorthand": true
                        }
                    ]
                }
            }
        }
    ],
    "sourceType": "script"
});

module.exports = {
    _applyModifiersHeader,
    _validateCheck,    
    _fieldRequirementCheck,
    restMethods
};
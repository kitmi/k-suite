/* Oolong Parser for Jison */

/* JS declaration */
%{
    function ParserState () {
        this.indents = [0];
        this.indent = 0;
        this.dedents = 0;
        this.eof = false;
        this.comment = false;
        this.brackets = [];
        this.parsed = {};
        this.stateStack = [];
    }

    ParserState.prototype = {
        get hasBrackets() {
            return this.brackets.length > 0;
        },

        get lastIndent() {
            return this.indents[this.indents.length - 1]
        },

        get hasIndent() {
            return this.indents.length > 0;
        },

        doIndent() {
            this.indents.push(this.indent);
        },

        doDedent() {
            this.dedents = 0;

            while (this.indents.length) {
                this.dedents++;
                this.indents.pop();
                if (this.lastIndent == this.indent) break;
            }
        },

        dedentAll() {
            this.indent = 0;
            this.dedents = this.indents.length - 1;
            this.indents = [0];
        },

        enterObject() {
            this.stateStack.push('object');
        },

        exitObject() {
            let current = this.stateStack.pop();
            if (current !== 'object') {
                throw new Error('Unmatched object bracket!');
            }
        },

        enterArray() {
            this.stateStack.push('array');
        },

        exitArray() {
            let current = this.stateStack.pop();
            if (current !== 'array') {
                throw new Error('Unmatched array bracket!');
            }
        },

        isTypeExist(type) {
            return this.parsed.type && (type in this.parsed.type);
        },

        use(namespace) {
            if (!this.parsed.namespace) {
                this.parsed.namespace = [];
            }

            this.parsed.namespace.push(namespace);
        },

        defConst(name, value, line) {
            if (!this.parsed.const) {
                this.parsed.const = {};
            }

            if (name in this.parsed.const) {
                throw new Error('Duplicate constant definition detected at line ' + line + '.');
            }

            this.parsed.const[name] = value;
        },

        defType(type, def) {
            if (!this.parsed.type) {
                this.parsed.type = {};
            }

            this.parsed.type[type] = def;
        },

        isEntityExist(entity) {
            return this.parsed.entity && (entity in this.parsed.entity);
        },

        defEntity(entity, def) {
            if (!this.parsed.entity) {
                this.parsed.entity = {};
            }
            this.parsed.entity[entity] = Object.assign({}, this.parsed.entity[entity], def);
        },

        defRelation(relation) {
            if (!this.parsed.relation) {
                this.parsed.relation = [];
            }

            if (Object.prototype.toString.call(relation) === '[object Array]') {
                this.parsed.relation = this.parsed.relation.concat(relation);
            } else {
                this.parsed.relation.push(relation);
            }
        },

        defSchema(schema, def) {
            this.parsed.schema = Object.assign({}, { name: schema }, def);
        },

        defView(viewName, def) {
            if (!this.parsed.view) {
                this.parsed.view = {};
            }
            this.parsed.view[viewName] = Object.assign({}, this.parsed.view[viewName], def);
        },

        defDocument(docName, def) {
            if (!this.parsed.document) {
                this.parsed.document = {};
            }
            this.parsed.document[docName] = Object.assign({}, this.parsed.document[docName], def);
        },

        validate() {
            var errors = [];

            //add validations here

            if (errors.length > 0) {
                throw new Error(errors.join("\n"));
            }

            return this;
        },

        build() {
            return this.parsed;
        }
    };

    var UNITS = new Map([['K', 1024], ['M', 1048576], ['G', 1073741824], ['T', 1099511627776]]);

    function parseSize(size) {
        if (UNITS.has(size.substr(-1))) {
            let unit = size.substr(-1);
            let factor = UNITS[unit];

            size = size.substr(0, size.length - 1);

            return parseInt(size) * factor;
        } else {
            return parseInt(size);
        }
    }

    function unquoteString(str, quotes) {
        return str.substr(quotes, str.length-quotes*2);
    }

    function normalizeIdentifier(id) {
        return id[0] === '`' ? id.substr(1, id.length-2) : id;
    }

    function normalizeDotName(name) {
        return name.split('.').map(n => normalizeIdentifier(n.trim())).join('.');
    }

    function normalizeReference(ref) {
        return { oolType: 'ObjectReference', name: ref.substr(1) };
    }

    var KEYWORDS = new Set([
        "not", "and", "or", "xor", "mod", "div", "in", "is", "like", //operators
        'int', 'integer', 'number', 'text', 'bool', 'boolean', 'blob', 'binary', 'datetime', 'date', 'time', 'year', 'timestamp', 'json', 'xml', 'enum', 'csv',
        'exact', 'unsigned', "only", "fixedLength",
        "import", "const", "type", "entity", "schema", "database", "relation", "default", "auto", "entities", "data",
        "with", "has", "have", "key", "index", "as", "unique", "for",
        "every", "may", "a", "several", "many", "great", "of", "one", "to", "an",
        "optional", "readOnly", "fixedValue", "forceUpdate",
        "interface", "accept", "do", "select", "where", "return", "exists", "null", "otherwise", "unless", "find", "by", "case",
        "skip", "limit", "update", "create", "delete", "set", "throw", "error",
        "view", "order", "list", "asc", "desc", "views", "group", "skip",
        "document", "contains", "being", "which"
    ]);

    var BRACKET_PAIRS = {
        '}': '{',
        ']': '[',
        ')': '('
    };

    var DB_TYPES = new Set([
        "mysql", "mongodb"
    ]);

    var BUILTIN_TYPES = new Set([ 'int', 'float', 'decimal', 'text', 'bool', 'binary', 'datetime', 'json', 'xml', 'enum', 'csv' ]);
    var OOL_TYPE_KEYWORDS = new Set([ 'int', 'integer', 'number', 'text', 'bool', 'boolean', 'blob', 'binary',
        'datetime', 'date', 'time', 'timestamp', 'json', 'xml', 'enum', 'csv' ]);

    var BUILTIN_TYPE_ATTR = [
        'type',
        'digits',
        'range',
        'values',
        'unsigned',
        'totalDigits',
        'maxLength',
        'fixedLength'
    ];

    if (typeof exports !== 'undefined') {
        exports.BUILTIN_TYPES = BUILTIN_TYPES;
        exports.OOL_TYPE_KEYWORDS = OOL_TYPE_KEYWORDS;
        exports.BUILTIN_TYPE_ATTR = BUILTIN_TYPE_ATTR;
        exports.KEYWORDS = KEYWORDS;
    }

    var state;
%}

%lex

uppercase               [A-Z]
lowercase               [a-z]
digit                   [0-9]

space           		\ |\t
newline		            \n|\r\n|\r|\f

// identifiers
member_access           {identifier}("."{identifier})+
column_range            {variable}".""*"
variable                {member_access}|{identifier}
object_reference        "@"{variable}

identifier              {identifier1}|{identifier2}
identifier1             ({xid_start1})({xid_continue})*
identifier2             "`"({xid_start2})({xid_continue})*"`"
xid_start1              "_"|"$"|({uppercase})|({lowercase})
xid_start2              "_"|({uppercase})|({lowercase})
xid_continue            {xid_start1}|{digit}

bool_value              ("true")|("false")

// numbers
bytes                   {integer}("B"|"b")
bit_integer             {integer}("K"|"M"|"G"|"T")
integer                 ({decinteger})|({hexinteger})|({octinteger})
decinteger              (([1-9]{digit}*)|"0")
hexinteger              "0"[x|X]{hexdigit}+
octinteger              "0"[o|O]{octdigit}+
bininteger              "0"[b|B]{bindigit}+
hexdigit                {digit}|[a-fA-F]
octdigit                [0-7]
bindigit                [0|1]

floatnumber             {exponentfloat}|{pointfloat}
exponentfloat           ({digit}+|{pointfloat}){exponent}
pointfloat              ({digit}*{fraction})|({digit}+".")
fraction                "."{digit}+
exponent                [e|E][\+|\-]({digit})+

// regexp literal
regexp                  "/"{regexp_item}*"/"{regexp_flag}*
regexp_item             {regexp_char}|{escapeseq}
regexp_char             [^\\\n\/]
regexp_flag             "i"|"g"|"m"|"y"

// reserved
symbol_operators        {syntax_operators}|{relation_operators}|{math_operators}
word_operators          {logical_operators}|{math_operators2}|{relation_operators2}
bracket_operators       "("|")"|"["|"]"|"{"|"}"
syntax_operators        "~"|","|":"|"|"|"--"|"->"|"=>"|"<->"|"<-"
relation_operators      "!="|">="|"<="|">"|"<"|"="
logical_operators       "not"|"and"|"or"|"xor"
math_operators          "+"|"-"|"*"|"/"
math_operators2         "mod"|"div"
relation_operators2     "in"|"is"|"like"
square_bracket_left     "["
bracket_left            "{"
parentheses_left        "("

// strings
longstring              {longstring_double}|{longstring_single}
longstring_double       '"""'{longstringitem}*'"""'
longstring_single       "'''"{longstringitem}*"'''"
longstringitem          {longstringchar}|{escapeseq}
longstringchar          [^\\]

shortstring             {shortstring_double}|{shortstring_single}
shortstring_double      '"'{shortstringitem_double}*'"'
shortstring_single      "'"{shortstringitem_single}*"'"
shortstringitem_double  {shortstringchar_double}|{escapeseq}
shortstringitem_single  {shortstringchar_single}|{escapeseq}
shortstringchar_single  [^\\\n\']
shortstringchar_double  [^\\\n\"]
escapeseq               \\.

// INITIAL program start
// EMPTY new line start
// DEDENTS after DEDENTS
// INLINE inline
// OBJECT_KEY inside a object, key part
// OBJECT_VALUE inside a array, value part
// ARRAY inside a array
// FUNCTION
%s INITIAL EMPTY DEDENTS INLINE

%%

<INITIAL><<EOF>>        %{  return 'EOF';  %}

<INITIAL>.|\n           %{  //start the program
                            this.unput(yytext);
                            this.begin('EMPTY');

                            state = new ParserState();
                        %}

<EMPTY,INLINE><<EOF>>   %{
                            if (this.topState(0) === 'INLINE' && !state.comment && !state.eof) {
                                this.unput(' ');

                                state.eof = true;
                                this.begin('EMPTY');
                                return 'NEWLINE';

                            } else if (state.indents.length > 1) {
                            //reach end-of-file, but a current block still not in ending state

                                //put back the eof
                                this.unput(' ');

                                //dedent all
                                state.dedentAll();
                                state.eof = true;
                                this.begin('DEDENTS');

                            } else {
                                this.begin('INITIAL');
                                return 'EOF';
                            }
                        %}
<EMPTY>\                %{ state.indent++; %}
<EMPTY>\t               %{ state.indent = (state.indent + 8) & -7; %}
<EMPTY>\n               %{ state.indent = 0; if (state.comment) state.comment = false; %} // blank line
<EMPTY,INLINE>\#.*      %{ state.comment = true; %} /* skip comments */
<EMPTY>.                %{
                            this.unput( yytext )
                            //compare the current indents with the last
                            var last = state.lastIndent;
                            if (state.indent > last) {
                                //new indent
                                state.doIndent();
                                this.begin('INLINE');
                                return 'INDENT';

                            } else if (state.indent < last) {
                                //dedent
                                state.doDedent();
                                if (!state.hasIndent) {
                                    throw new Error("Inconsistent indentation.");
                                }
                                this.begin('DEDENTS');

                            } else {
                                //same indent
                                this.begin('INLINE');
                            }
                        %}
<DEDENTS>.|<<EOF>>      %{
                            if (state.dedents-- > 0) {
                                this.unput(yytext);
                                return 'DEDENT';

                            } else if (state.eof) {
                                this.popState();

                            } else {
                                this.unput(yytext);
                                this.begin('INLINE');
                            }
                        %}
<INLINE>{longstring}    %{
                            yytext = unquoteString(yytext, 3);
                            return 'STRING';
                        %}
<INLINE>{shortstring}   %{
                            yytext = unquoteString(yytext, 1);
                            return 'STRING';
                        %}
<INLINE>{newline}       %{
                            // implicit line joining
                            if (!state.hasBrackets) {
                                state.indent = 0;
                                this.begin('EMPTY');

                                if (state.comment) {
                                    state.comment = false;
                                }

                                return 'NEWLINE';
                            }
                        %}
<INLINE>{space}+       /* skip whitespace, separate tokens */

<INLINE>{bracket_operators}     %{
                            if (yytext == '{' || yytext == '[' || yytext == '(') {
                                state.brackets.push(yytext);
                            } else if (yytext == '}' || yytext == ']' || yytext == ')') {
                                var paired = BRACKET_PAIRS[yytext];
                                var lastBracket = state.brackets.pop();
                                if (paired !== lastBracket) {
                                    throw new Error("Inconsistent bracket.")
                                }
                            }
                            return yytext;
                        %}
<INLINE>{regexp}        return 'REGEXP';
<INLINE>{floatnumber}   %{
                            yytext = parseFloat(yytext);
                            return 'FLOAT';
                        %}
<INLINE>{bit_integer}   %{
                            yytext = parseSize(yytext);
                            return 'INTEGER';
                        %}
<INLINE>{bytes}         %{
                            yytext = parseInt(yytext.substr(0, yytext.length - 1));
                            return 'BYTES';
                        %}
<INLINE>{integer}       %{
                            yytext = parseInt(yytext);
                            return 'INTEGER';
                        %}
<INLINE>{member_access}    %{
                                yytext = normalizeDotName(yytext);
                                return 'DOTNAME';
                           %}
<INLINE>{object_reference} %{
                                yytext = normalizeReference(yytext);
                                return 'REFERENCE';
                           %}
<INLINE>{column_range}     %{
                                return 'COLUMNS';
                           %}
<INLINE>{bool_value}       %{
                                yytext = (yytext === 'true');
                                return 'BOOL';
                           %}
<INLINE>{symbol_operators}  return yytext;
<INLINE>{identifier}    %{
                            if (KEYWORDS.has(yytext)) {
                                if (state.brackets.indexOf('{') !== -1) {
                                    return 'NAME';
                                }

                                return yytext;
                            }

                            yytext = normalizeIdentifier(yytext);
                            return 'NAME';
                        %}

/lex

%right "<-"
%left "=>"
%left "or"
%left "xor"
%left "and"
%nonassoc "in" "is" "like"
%left "not"
%left "!=" ">=" "<=" ">" "<" "="
%left "+" "-"
%left "*" "/" "mod" "div"

%ebnf

%start program

%%

/** grammar **/
program
    : input
        {
            var r = state;
            state = null;
            return r ? r.validate().build() : '';
        }
    ;

input
    : EOF
    | input0 EOF
    ;

input0
    : NEWLINE
    | statement
    | NEWLINE input0
    | statement input0
    ;

statement
    : use_statement
    | const_statement
    | type_statement
    | entity_statement
    | schema_statement
    | view_statement
    | document_statement
    | relation_statement
    ;

use_statement
    : "import" STRING NEWLINE
        { state.use($2); }
    | "import" NEWLINE INDENT use_statement_block DEDENT
    ;

use_statement_block
    : STRING NEWLINE
        { state.use($1); }
    | STRING NEWLINE use_statement_block
        { state.use($1); }
    ;

const_statement
    : "const" const_statement_item NEWLINE
    | "const" NEWLINE INDENT const_statement_block DEDENT
    ;

const_statement_item
    : identifier "=" literal
        {
            state.defConst($1, $3, @1.first_line);   
        }
    ;

const_statement_block
    : const_statement_item NEWLINE
    | const_statement_item NEWLINE const_statement_block
    ;    

type_statement
    : "type" type_statement_item NEWLINE
    | "type" NEWLINE INDENT type_statement_block DEDENT
    ;

type_statement_item
    /* type definition can only contain 0-stage validators */
    : identifier type_base_or_not default_value_or_not type_validators0_or_not
        {
            var n = $1;
            if (state.isTypeExist(n)) throw new Error('Duplicate type definition detected at line ' + @1.first_line + '.');
            if (BUILTIN_TYPES.has(n)) throw new Error('Cannot use built-in type "' + n + '" as a custom type name at line ' + @1.first_line + '.');

            state.defType(n, Object.assign({type: 'text'}, $2, $3, $4));
        }
    ;

type_base_or_not
    :
    | type_base
    ;

type_base
    : ':' types -> $2
    ;

types
    : int_type unsigned_or_not
        { $$ = Object.assign({}, $1, $2); }
    | number_type
        { $$ = Object.assign({ type: 'float' }, $1); }
    | number_type 'exact'
        { $$ = Object.assign({ type: 'decimal' }, $1); }
    | text_type
    | bool_keyword
        { $$ = { type: 'bool' }; }
    | binary_type
    | 'datetime'
        { $$ = { type: 'datetime', range: 'datetime' }; }
    | 'datetime' 'date' 'only'
        { $$ = { type: 'datetime', range: 'date' }; }
    | 'datetime' 'time' 'only'
        { $$ = { type: 'datetime', range: 'time' }; }
    | 'datetime' 'year' 'only'
        { $$ = { type: 'datetime', range: 'year' }; }
    | 'timestamp'
        { $$ = { type: 'datetime', range: 'timestamp' }; }
    | 'json'
        { $$ = { type: 'json' }; }
    | 'xml'
        { $$ = { type: 'xml' }; }
    | 'csv'
        { $$ = { type: 'csv' }; }
    | identifier_or_str_array
        { $$ = { type: 'enum', values: $1 }; }
    | identifier_or_string
        { $$ = { type: $1 }; }
    | DOTNAME
        { $$ = { type: $1 }; }
    ;

int_keyword
    : 'int'
    | 'integer'
    ;

int_type
    : int_keyword -> { type: 'int' }
    | int_keyword '(' INTEGER ')' -> { type: 'int', digits: parseInt($3) }
    | int_keyword '(' BYTES ',' INTEGER  ')' -> { type: 'int', bytes: $3, digits: parseInt($5) }
    | int_keyword '(' BYTES ')' -> { type: 'int', bytes: $3 }
    ;

unsigned_or_not
    :
    | 'unsigned'
        { $$ = { unsigned: true }; }
    ;

number_type
    : 'number'
        { $$ = {}; }
    | 'number' '(' INTEGER ')'
        { $$ = { totalDigits: parseInt($3) }; }
    | 'number' '(' ',' INTEGER ')'
        { $$ = { decimalDigits: parseInt($4) }; }
    | 'number' '(' INTEGER ',' INTEGER ')'
        { $$ = { totalDigits: parseInt($3), decimalDigits: parseInt($5) }; }
    ;

text_type
    : 'text'
        { $$ = { type: 'text' }; }
    | 'text' '(' INTEGER ')'
        { $$ = { type: 'text', maxLength: parseInt($3) }; }
    | 'text' '(' INTEGER ')' 'fixedLength'
        { $$ = { type: 'text', fixedLength: parseInt($3) }; }
    ;

bool_keyword
    : 'bool'
    | 'boolean'
    ;

binary_type
    : binary_keyword
        { $$ = { type: 'binary' }; }
    | binary_keyword '(' INTEGER ')'
        { $$ = { type: 'binary', maxLength: $3 }; }
    | binary_keyword '(' INTEGER ')' 'fixedLength'
        { $$ = { type: 'binary', fixedLength: $3 }; }
    ;

binary_keyword
    : 'blob'
    | 'binary'
    ;

type_validators0_or_not
    :
    | type_validators0
    ;

type_validators0
    : type_validators
        { $$ = { validators0: $1.validators }; }
    ;

default_value_or_not
    :
    | default_value
    ;

type_statement_block
    : type_statement_item NEWLINE
    | type_statement_item NEWLINE type_statement_block
    ;

entity_statement
    : entity_statement_header NEWLINE -> state.defEntity($1[0], $1[1])
    | entity_statement_header NEWLINE INDENT entity_statement_block DEDENT -> state.defEntity($1[0], Object.assign({}, $1[1], $4))
    ;

entity_statement_header
    : entity_statement_header0 -> [ $1 ]
    | entity_statement_header0 "is" identifier_or_string -> [ $1, { base: $3 } ]
    ;

entity_statement_header0
    : "entity" identifier_or_string
        {
            if (state.isEntityExist($2)) throw new Error('Duplicate entity definition detected at line ' + @1.first_line + '.');
            $$ = $2;
        }
    ;

entity_statement_block
    : comment_or_not with_stmt_or_not has_stmt_or_not key_stmt_or_not index_stmt_or_not data_stmt_or_not interface_stmt_or_not
        { $$ = Object.assign({}, $1, $2, $3, $4, $5, $6, $7); }
    ;

comment_or_not
    :
    | "--" STRING NEWLINE
        { $$ = { comment: $2 }; }
    ;

with_stmt_or_not
    :
    | with_stmt
    ;

has_stmt_or_not
    :
    | has_stmt
    ;

key_stmt_or_not
    :
    | key_stmt
    ;

index_stmt_or_not
    :
    | index_stmt
    ;

data_stmt_or_not
    :
    | data_stmt
    ;

interface_stmt_or_not
    :
    | interface_stmt
    ;

with_stmt
    : "with" feature_inject NEWLINE
        { $$ = { features: [ $2 ] }; }
    | "with" NEWLINE INDENT with_stmt_block DEDENT
        { $$ = { features: $4 }; }
    ;

with_stmt_block
    : feature_inject NEWLINE -> [ $1 ]
    | feature_inject NEWLINE with_stmt_block -> [ $1 ].concat($3)
    ;

has_stmt
    : "has" has_stmt_itm NEWLINE
        { $$ = { fields: { [$2[0]]: $2[1] } }; }
    | "has" NEWLINE INDENT has_stmt_block DEDENT
        { $$ = { fields: $4 }; }
    ;

has_stmt_itm
    : has_stmt_item_body field_comment_or_not
        { $1[1] = Object.assign({}, $1[1], $2); }
    ;

has_stmt_item_body
    : identifier_or_string type_base_or_not field_qualifiers_or_not with_validators_modifiers
        { $$ = [$1, Object.assign({ type: $1 }, $2, $3, $4)]; }
    | identifier_or_string field_reference optional_qualifier_or_not
        { $$ = [$1, Object.assign({}, $2, $3) ]; }
    ;

/** default value with literal **/
concrete_default_value
    : "default" "(" literal ")" -> { 'default': $3 }
    ;

/** default value with literal or auto generator **/
default_value
    : concrete_default_value
    | "default" "(" "auto" ")" -> { auto: true }
    | "auto" -> { auto: true } /** generator by base type **/
    | "auto" "(" identifier_or_string ")" -> { auto: true, generator: $3 }    
    | "auto" "(" identifier_or_string literal ")" -> { auto: true, generator: { name: $3, options: $4 } }    
    | "=" function_call -> { 'computedBy': $2 }
    ;

field_qualifiers_or_not
    :
    | field_qualifiers
    ;

field_modifiers0_or_not
    :
    | field_modifiers0
    ;

field_modifiers0
    : variable_modifiers
        { $$ = { modifiers0: $1.modifiers }; }
    ;

field_validators1_or_not
    :
    | field_validators1
    ;

field_validators1
    : type_validators
        { $$ = { validators1: $1.validators }; }
    ;

field_modifiers1_or_not
    :
    | field_modifiers1
    ;

field_modifiers1
    : variable_modifiers
        { $$ = { modifiers1: $1.modifiers }; }
    ;

variable_modifier_or_not
    :
    | variable_modifiers
    ;

optional_qualifier_or_not
    :
    | optional_qualifier
    ;

field_qualifiers
    : field_qualifier
    | field_qualifier field_qualifiers
        {
            for (var k in $2) {
                if (k in $1) {
                    throw new Error('Duplicate field qualifier detected at line ' + @1.first_line + '.');
                }
            }
            $$ = Object.assign({}, $1, $2);
        }
    ;

field_restriction
    : "readOnly"
        { $$ = { readOnly: true }; }
    | "fixedValue"
        { $$ = { fixedValue: true }; }
    | "forceUpdate"
        { $$ = { forceUpdate: true }; }
    ;

field_comment_or_not
    :
    | "--" STRING
        { $$ = { comment: $2 }; }
    ;

field_qualifier
    : default_value
    | optional_qualifier
    | field_restriction
    ;

optional_qualifier
    : "optional"
        { $$ = { optional: true }; }
    ;

variable_modifiers
    : variable_modifier
        { $$ = { modifiers: [ $1 ] }; }
    | variable_modifier variable_modifiers
        {
            $$ = { modifiers: [ $1 ].concat($2.modifiers) };
        }
    ;

variable_modifier
    : "|" identifier_or_member_access
        { $$ = { name: $2 }; }
    | "|" function_call
        { $$ = $2; }
    ;

type_validators
    : type_validator
    | type_validator type_validators
        { $$ = { validators: $1.validators.concat($2.validators) }; }
    ;

type_validator
    : "~" identifier_or_member_access
        { $$ = { validators: [ { name: $2 } ] }; }
    | "~" function_call
        { $$ = { validators: [ $2 ] }; }
    ;

field_reference
    : "->" identifier_or_member_access
        { $$ = { belongTo: $2 }; }
    | "<->" identifier_or_member_access
        { $$ = { bindTo: $2 }; }
    ;

has_stmt_block
    : has_stmt_itm NEWLINE
        { $$ = { [$1[0]]: $1[1] }; }
    | has_stmt_itm NEWLINE has_stmt_block
        { $$ = Object.assign({}, { [$1[0]]: $1[1] }, $3); }
    ;

key_stmt
    : "key" identifier NEWLINE
        { $$ = { key: $2 }; }
    ;

index_stmt_itm
    : identifier
        { $$ = { fields: $1 }; }
    | identifier_or_str_array
        { $$ = { fields: $1 }; }
    | index_stmt_itm index_qualifiers
        { $$ = Object.assign({}, $1, $2); }
    ;

index_qualifiers
    : "is" "unique"
        { $$ = { unique: true }; }
    ;

index_stmt
    : "index" index_stmt_itm NEWLINE
        { $$ = { indexes: [$2] }; }
    | "index" NEWLINE INDENT index_stmt_blk DEDENT
        { $$ = { indexes: $4 }; }
    ;

index_stmt_blk
    : index_stmt_itm NEWLINE
        { $$ = [$1]; }
    | index_stmt_itm NEWLINE index_stmt_blk
        { $$ = [$1].concat($3); }
    ;

data_stmt
    : "data" inline_object NEWLINE
        { $$ = { data: $2 }; }
    | "data" inline_array NEWLINE
        { $$ = { data: $2 }; }
    ;

interface_stmt
    : "interface" NEWLINE INDENT interface_stmt_blk DEDENT
        { $$ = { interface: $4 }; }
    ;

interface_stmt_blk
    : interface_def
        { $$ = Object.assign({}, $1); }
    | interface_def interface_stmt_blk
        { $$ = Object.assign({}, $1, $2); }
    ;

interface_def
    : identifier NEWLINE INDENT interface_def_body DEDENT
        { $$ = { [$1]: $4 }; }
    ;

interface_def_body
    : accept_or_not implementation return_or_not
        { $$ = Object.assign({}, $1, { implementation: $2 }, $3); }
    ;

accept_or_not
    :
    | accept_statement
    ;

accept_statement
    : "accept" parameter_with_modifier NEWLINE -> { accept: [ $2 ] }
    | "accept" NEWLINE INDENT accept_block DEDENT -> { accept: $4 }
    ;

accept_block
    : parameter_with_modifier NEWLINE -> [ $1 ]
    | parameter_with_modifier NEWLINE accept_block -> [ $1 ].concat($3)
    ;

parameter_with_modifier
    : parameter with_type_default_value with_validators_modifiers -> Object.assign($1, { type: $1.name }, $2, $3)
    ;

with_type_default_value
    :
    | type_base
    | concrete_default_value
    | type_base concrete_default_value -> Object.assign({}, $1, $2)
    ;

with_validators_modifiers
    :
    | type_validators0
    | field_modifiers0
    | type_validators0 field_modifiers0 -> Object.assign({}, $1, $2)
    | field_modifiers0 field_validators1 -> Object.assign({}, $1, $2)
    | type_validators0 field_modifiers0 field_validators1 -> Object.assign({}, $1, $2, $3)
    | field_modifiers0 field_validators1 field_modifiers1 -> Object.assign({}, $1, $2, $3)
    | type_validators0 field_modifiers0 field_validators1 field_modifiers1 -> Object.assign({}, $1, $2, $3, $4)
    ;

implementation
    : operation
        { $$ = [ $1 ]; }
    | operation implementation
        { $$ = [ $1 ].concat($2); }
    ;

operation
    : find_one_operation
/*    | update_operation
    | create_operation
    | delete_operation
    | coding_block
    | assign_operation */
    ;

find_one_operation
    : "find" "one" identifier "by" "case" NEWLINE INDENT case_condition_block DEDENT
        { $$ = { oolType: 'findOne', model: $3, case: { items: $8 } }; }
    | "find" "one" identifier "by" "case" NEWLINE INDENT case_condition_block "otherwise" condition_as_result_expression NEWLINE DEDENT
            { $$ = { oolType: 'findOne', model: $3, case: { items: $8, else: $10 } }; }
    | "find" "one" identifier "by" conditional_expression NEWLINE
        { $$ = { oolType: 'findOne', model: $3, condition: $5}; }
    ;

update_operation
    : "update" identifier_or_string "with" inline_object where_expr NEWLINE
        { $$ = { oolType: 'update', target: $2, data: $4, filter: $5 }; }
    ;

create_operation
    : "create" identifier_or_string "with" inline_object NEWLINE
        { $$ = { oolType: 'create', target: $2, data: $4 }; }
    ;

delete_operation
    : "delete" identifier_or_string where_expr NEWLINE
        { $$ = { oolType: 'delete', target: $2, filter: $3 }; }
    ;

coding_block
    : "do" "{" javascript "}" NEWLINE
        { $$ = { oolType: 'javascript', script: $3 }; }
    ;

assign_operation
    : "set" identifier_or_member_access "<-" value variable_modifier_or_not NEWLINE
        { $$ = { oolType: 'assignment', left: $2, right: Object.assign({ argument: $4 }, $5) }; }
    ;

/*
select_stm
    : "select" column_range_list where_expr skip_or_not limit_or_not
        { $$ = Object.assign({ projection: $2, filter: $3 }, $4, $5); }
    ;
*/

case_condition_block
    : simple_conditional_arrow_expr NEWLINE
        { $$ = [ $1 ]; }
    | simple_conditional_arrow_expr NEWLINE case_condition_block
        { $$ = [ $1 ].concat($3); }
    ;

where_expr
    : "where" where_expr_condition
        { $$ = $2; }
    | "where" NEWLINE INDENT where_expr_condition_blk DEDENT
        { $$ = $4; }
    ;

where_expr_condition
    : query_condition_expression
    ;

where_expr_condition_blk
    : where_expr_condition NEWLINE
        { $$ = [ $1 ]; }
    | where_expr_condition NEWLINE where_expr_condition_blk
        { $$ = [ $1 ].concat($3); }
    ;

simple_conditional_arrow_expr
    : conditional_expression "=>" condition_as_result_expression
        { $$ = { oolType: 'ConditionalStatement', test: $1, then: $3 } }
    ;
/*
conditional_where_expr
    : simple_conditional_arrow_expr
    | conditional_expression "=>" query_condition_expression "otherwise" query_condition_expression
        { $$ = { oolType: 'ConditionalStatement', test: $1, then: $3, 'else': $4 } }
    ;
*/

return_or_not
    :
    | return_expression NEWLINE
        { $$ = { return: $1 }; }
    | return_expression "unless" NEWLINE INDENT return_condition_blk DEDENT
        { $$ = { return: Object.assign($1, { exceptions: $5 }) }; }
    ;

return_expression
    : "return" concrete_value
        { $$ = { oolType: 'ReturnExpression', value: $2 }; }
    ;

return_condition_blk
    : conditional_expression "=>" concrete_value NEWLINE
        { $$ = { oolType: 'ConditionalStatement', test: $1, then: $3 } }
    | conditional_expression "=>" concrete_value NEWLINE return_condition_blk
        { $$ = [ { oolType: 'ConditionalStatement', test: $1, then: $3 } ].concat($5); }
    ;

relation_statement
    : "relation" relation_statement_itm NEWLINE
        { state.defRelation($2); }
    | "relation" NEWLINE INDENT relation_statement_blk DEDENT
        { state.defRelation($4); }
    ;

relation_statement_blk
    : relation_statement_itm NEWLINE
        { $$ = [ $1 ]; }
    | relation_statement_itm NEWLINE relation_statement_blk
        { $$ = [ $1 ].concat($3); }
    ;

relation_statement_itm
    : relation_statement_itm0
    | relation_statement_itm0 "to" related_entity
        {
            if ($1.right === $3.right) {
                throw new Error('Invalid relation declaration at line ' + @1.first_line + '.');
            }
            let right2 = { relationship: $1.relationship, size: $1.size };
            let right1Name = $3.right;
            delete $3.right;

            $$ = Object.assign({}, $1, { right: { [right1Name]: $3, [$1.right]: right2 }, type: 'chain' });
            delete $$.relationship;
            delete $$.size;
        }
    | relation_statement_itm0 "for" indefinite_article identifier_or_member_access
        {
            let right1Name2 = $1.left;
            let right2Name2 = $4;

            $$ = Object.assign({}, $1, { relationship: $1.relationship.replace('n:', '1:') }, { left: $1.right, right: [ right1Name2, right2Name2 ], type: 'multi' });
        }
    ;

related_entity
    : relation_qualifier identifier_or_member_access
        { $$ = Object.assign({}, $1, { right: $2 }); }
    ;

relation_statement_itm0
    : "every" identifier_or_member_access "has" related_entity
        { $$ = Object.assign({ left: $2 }, $4); }
    | indefinite_article identifier_or_member_access "may" "have" related_entity
        { $$ = Object.assign({ left: $2, optional: true }, $5); }
    ;

relation_qualifier
    : "one"
        { $$ = { relationship: 'n:1', size: 'one' }; }
    | "several"
        { $$ = { relationship: 'n:n', size: 'small' }; }
    | "many"
        { $$ = { relationship: 'n:n', size: 'medium' }; }
    | "a" "great" "number" "of"
        { $$ = { relationship: 'n:n', size: 'large' }; }
    ;

schema_statement
    : "schema" identifier_or_string NEWLINE INDENT schema_statement_block DEDENT
        {
            if (state.parsed.schema) throw new Error('Only one schema definition allowed in a schema file. Extra schema definition detected at line ' + @1.first_line + '.');
            state.defSchema($2, $5);
        }
    ;

schema_statement_block
    : schema_entities schema_views_or_not -> Object.assign({}, $1, $2)
    ;

schema_views_or_not
    :
    | schema_views
    ;

schema_entities
    : "entities" NEWLINE INDENT schema_entities_block DEDENT -> { entities: $4 }
    ;

schema_entities_block
    : identifier_or_string NEWLINE -> [ $1 ]
    | identifier_or_string NEWLINE schema_entities_block -> [ $1 ].concat($3)
    ;

schema_views
    : "views" NEWLINE INDENT schema_views_block DEDENT -> { views: $4 }
    ;

schema_views_block
    : identifier_or_member_access NEWLINE -> [ $1 ]
    | identifier_or_member_access NEWLINE schema_views_block -> [ $1 ].concat($3)
    ;

document_statement
    : "document" identifier_or_string NEWLINE INDENT document_statement_block DEDENT -> state.defDocument($2, $5)
    ;

document_statement_block
    : "contains" identifier_or_string NEWLINE -> { entity: $2 }
    | "contains" identifier_or_string NEWLINE document_statement_block2 -> { entity: $2, joinWith: $4 }
    ;

document_statement_block2
    : "with" document_entity_join NEWLINE -> [ $2 ]
    | "with" document_entity_join NEWLINE document_statement_block2 -> [ $2 ].concat($4)
    ;

document_entity_join
    : identifier_or_string "being" identifier_or_member_access -> { entity: $1, on: { left: $3, right: '$key' } }
    | identifier_or_string "document" "of" "which" identifier_or_member_access "being" identifier_or_member_access -> { document: $1, on: { left: $7, right: $5 } }
    ;

/*
document_entity_merged
    : identifier_or_string -> { nestedUnder: $1 }
    ;

document_entity_reference
    : document_entity_join
    | document_entity_join "=>" document_entity_merged -> Object.assign({}, $1, $3)
    | document_entity_join "=>" DOTNAME -> Object.assign({}, $1, { nestedUnder: $3 })
    ;
*/

view_statement
    : "view" identifier_or_string NEWLINE INDENT view_statement_block DEDENT -> state.defView($2, $5)
    ;

view_statement_block
    : view_main_entity NEWLINE accept_or_not view_selection_or_not group_by_or_not order_by_or_not skip_or_not limit_or_not
        -> Object.assign({}, $1, $3, $4, $5, $6, $7, $8)
    ;

view_joinings_or_not
    :
    | view_joinings
    ;

view_main_entity
    : "is" indefinite_article view_entity_target -> $3
    | "is" indefinite_article view_entity_target "list" -> Object.assign({}, $3, { isList: true })
    ;

view_entity_target
    : identifier_or_string -> { entity: $1 }
    | identifier_or_string "document" -> { document: $1 }
    ;

view_selection_or_not
    :
    | view_selection
    ;

view_selection
    : "select" "by" conditional_expression NEWLINE
        { $$ = { selectBy: [ $3 ] }; }
    | "select" "by" NEWLINE INDENT view_selection_block DEDENT
        { $$ = { selectBy: $5 }; }
    ;

view_selection_block
    : conditional_expression NEWLINE -> [ $1 ]
    | conditional_expression NEWLINE view_selection_block -> [ $1 ].concat($3)
    ;

group_by_or_not
    :
    | "group" "by" order_by_list NEWLINE -> { groupBy: $3 }
    | "group" "by" NEWLINE INDENT order_by_block DEDENT -> { groupBy: $5 }
    ;

order_by_or_not
    :
    | "order" "by" order_by_list NEWLINE -> { orderBy: $3 }
    | "order" "by" NEWLINE INDENT order_by_block DEDENT -> { orderBy: $5 }
    ;

order_by_block
    : order_by_clause NEWLINE -> [ $1 ]
    | order_by_clause NEWLINE order_by_block -> [ $1 ].concat($3)
    ;

order_by_clause
    : identifier_or_member_access -> { field: $1, ascend: true }
    | identifier_or_member_access "asc" -> { field: $1, ascend: true }
    | identifier_or_member_access "desc" -> { field: $1, ascend: false }
    ;

order_by_list
    : order_by_clause -> [ $1 ]
    | order_by_clause order_by_list0 -> [ $1 ].concat($2)
    ;

order_by_list0
    : "," order_by_clause -> [ $2 ]
    | "," order_by_clause order_by_list0 -> [ $2 ].concat($3)
    ;

skip_or_not
    :
    | "skip" value NEWLINE -> { skip: $2 }
    ;

limit_or_not
    :
    | "limit" value NEWLINE -> { limit: $2 }
    ;

identifier_or_member_access_list
    : identifier_or_member_access -> [ $1 ]
    | identifier_or_member_access identifier_or_member_access_list0 -> [ $1 ].concat($2)
    ;

identifier_or_member_access_list0
    : "," identifier_or_member_access -> [ $2 ]
    | "," identifier_or_member_access identifier_or_member_access_list0 -> [ $2 ].concat($3)
    ;

literal
    : INTEGER
    | FLOAT
    | BOOL
    | inline_object
    | inline_array
    | REGEXP
    | STRING
    ;

identifier
    : NAME
    | "order"
    | "type"
    | "desc"
    ;

indefinite_article
    : "a"
    | "an"
    ;

identifier_or_member_access
    : identifier
    | DOTNAME
    ;

parameter
    : identifier
        { $$ = { name: $1 }; }
    | STRING
        { $$ = { name: $1 }; }
    ;

function_call
    : identifier_or_member_access "(" ")"
        { $$ = { name: $1 }; }
    | identifier_or_member_access "(" modifiable_value_list ")"
        { $$ = { name: $1, args: $3 }; }
    ;
    
feature_inject
    : identifier_or_member_access
        { $$ = { name: $1 }; }
    | identifier_or_member_access "(" ")"
        { $$ = { name: $1 }; }
    | identifier_or_member_access "(" feature_param_list ")"
        { $$ = { name: $1, options: $3 }; }
    ;    
    
feature_param
    : literal
    | identifier
    ;

value
    : modifiable_value
    | identifier_or_member_access
        { $$ = { oolType: 'ConstReference', name: $1 } }
    | function_call
        { $$ = Object.assign({ oolType: 'FunctionCall' }, $1); }
    ;

concrete_value
    : literal
    | REFERENCE
    ;

modifiable_value
    : concrete_value
    | concrete_value_expression
    ;

identifier_or_string
    : identifier
    | STRING
    ;

inline_object
    : "{" "}"
        { $$ = {}; }
    | "{" kv_pairs "}"
        { $$ = $2; }
    ;

kv_pair_itm
    : identifier_or_string ":" value
        { $$ = {[$1]: $3}; }
    | INTEGER ":" value
        { $$ = {[$1]: $3}; }
    ;

kv_pairs
    : kv_pair_itm
    | kv_pair_itm kv_pairs0
        { $$ = Object.assign({}, $1, $2); }
    ;

kv_pairs0
    : "," kv_pair_itm
        { $$ = $2; }
    | "," kv_pair_itm kv_pairs0
        { $$ = Object.assign({}, $2, $3); }
    ;

inline_array
    : "[" "]"
        { $$ = []; }
    | "[" value_list "]"
        { $$ = $2; }
    ;

value_list
    : value
        { $$ = [ $1 ]; }
    | value value_list0
        { $$ = $1.concat( $2 ); }
    ;

value_list0
    : ',' value
        { $$ = [ $2 ]; }
    | ',' value value_list0
        { $$ = [ $2 ].concat( $3 ); }
    ;

modifiable_value_list
    : modifiable_value
        { $$ = $1; }
    | modifiable_value modifiable_value_list0
        { $$ = [ $1 ].concat( $2 ); }
    ;

modifiable_value_list0
    : ',' modifiable_value
        { $$ = [ $2 ]; }
    | ',' modifiable_value modifiable_value_list0
        { $$ = [ $2 ].concat( $3 ); }
    ;
    
feature_param_list
    : feature_param
        { $$ = $1; }
    | feature_param feature_param_list0
        { $$ = [ $1 ].concat( $2 ); }
    ;

feature_param_list0
    : ',' feature_param
        { $$ = [ $2 ]; }
    | ',' feature_param feature_param_list0
        { $$ = [ $2 ].concat( $3 ); }
    ;    

identifier_or_str_array
    : "[" "]" -> []
    | "[" identifier_or_str_list "]" -> $2
    ;

identifier_or_str_list
    : identifier_or_string
        { $$ = [ $1 ]; }
    | identifier_or_string identifier_or_str_list0
        { $$ = [ $1 ].concat($2); }
    ;

identifier_or_str_list0
    : ',' identifier_or_string
        { $$ = [ $2 ]; }
    | ',' identifier_or_string identifier_or_str_list0
        { $$ = [ $2 ].concat( $3 ); }
    ;

conditional_expression
    : logical_expression
    | simple_expression
    ;

query_condition_expression
    : logical_query_expression
    | binary_expression
    ;

condition_as_result_expression
    : concrete_value
    | return_expression
    | throw_error_expression
    ;

simple_expression
    : value
    | unary_expression
    | binary_expression
    ;

concrete_value_expression
    : concrete_value type_validators0
        { $$ = Object.assign({ oolType: 'PipedValue', value: $1 }, $2); }

    | concrete_value field_modifiers0
        { $$ = Object.assign({ oolType: 'PipedValue', value: $1 }, $2 ); }

    | concrete_value type_validators0 field_modifiers0
        { $$ = Object.assign({ oolType: 'PipedValue', value: $1 }, $2, $3); }

    | concrete_value field_modifiers0 field_validators1
        { $$ = Object.assign({ oolType: 'PipedValue', value: $1 }, $2, $3); }

    | concrete_value type_validators0 field_modifiers0 field_validators1
        { $$ = Object.assign({ oolType: 'PipedValue', value: $1 }, $2, $3, $4); }

    | concrete_value field_modifiers0 field_validators1 field_modifiers1
        { $$ = Object.assign({ oolType: 'PipedValue', value: $1 }, $2, $3, $4); }

    | concrete_value type_validators0 field_modifiers0 field_validators1 field_modifiers1
        { $$ = Object.assign({ oolType: 'PipedValue', value: $1 }, $2, $3, $4, $5); }
    ;

throw_error_expression
    : "throw" "error"
        { $$ = { oolType: 'ThrowExpression' }; }
    | "throw" "error" "(" STRING ")"
        { $$ = { oolType: 'ThrowExpression', message: $4 }; }
    | "throw" "error" "(" identifier ")"
        { $$ = { oolType: 'ThrowExpression', errorType: $4 }; }
    | "throw" "error" "(" identifier "," STRING  ")"
        { $$ = { oolType: 'ThrowExpression', errorType: $4, message: $6 }; }
    ;

unary_expression
    : value "exists"
        { $$ = { oolType: 'UnaryExpression', operator: 'exists', argument: $1 }; }
    | value "not" "exists"
        { $$ = { oolType: 'UnaryExpression', operator: 'not-exists', argument: $1 }; }
    | value "is" "null"
        { $$ = { oolType: 'UnaryExpression', operator: 'is-null', argument: $1 }; }
    | value "is" "not" "null"
        { $$ = { oolType: 'UnaryExpression', operator: 'is-not-null', argument: $1 }; }
    | not "(" simple_expression ")"
        { $$ = { oolType: 'UnaryExpression', operator: 'not', argument: $3, prefix: true }; }
    ;

binary_expression
    : value ">" value
        { $$ = { oolType: 'BinaryExpression', operator: '>', left: $1, right: $3 }; }
    | value "<" value
        { $$ = { oolType: 'BinaryExpression', operator: '<', left: $1, right: $3 }; }
    | value ">=" value
        { $$ = { oolType: 'BinaryExpression', operator: '>=', left: $1, right: $3 }; }
    | value "<=" value
        { $$ = { oolType: 'BinaryExpression', operator: '<=', left: $1, right: $3 }; }
    | value "=" value
        { $$ = { oolType: 'BinaryExpression', operator: '=', left: $1, right: $3 }; }
    | value "!=" value
        { $$ = { oolType: 'BinaryExpression', operator: '!=', left: $1, right: $3 }; }
    | value "in" value
        { $$ = { oolType: 'BinaryExpression', operator: 'in', left: $1, right: $3 }; }
    ;

logical_expression
    : simple_expression logical_expression_right
        { $$ = Object.assign({ left: $1 }, $2); }
    | "(" logical_expression ")" logical_expression_right
        { $$ = Object.assign({ left: $2 }, $4); }
    ;

logical_expression_right
    : logical_operators simple_expression
        { $$ = Object.assign({ oolType: 'BinaryExpression' }, $1, { right: $2 }); }
    | logical_operators "(" logical_expression ")"
        { $$ = Object.assign({ oolType: 'BinaryExpression' }, $1, { right: $3 }); }
    ;

logical_query_expression
    : binary_expression logical_expression_right
        { $$ = Object.assign({ left: $1 }, $2); }
    | "(" logical_expression ")" logical_expression_right
        { $$ = Object.assign({ left: $2 }, $4); }
    ;

logical_query_expression_right
    : logical_operators binary_expression
        { $$ = Object.assign({ oolType: 'BinaryExpression' }, $1, { right: $2 }); }
    | logical_operators "(" logical_expression ")"
        { $$ = Object.assign({ oolType: 'BinaryExpression' }, $1, { right: $3 }); }
    ;

logical_operators
    : "and"
        { $$ = { operator: 'and' }; }
    | "or"
        { $$ = { operator: 'or' }; }
    ;

column_range_list
    : COLUMNS
        { $$ = [ $1 ]; }
    | COLUMNS column_range_list0
        { $$ = [ $1 ].concat($2); }
    ;

column_range_list0
    : ',' COLUMNS
        { $$ = [ $2 ]; }
    | ',' COLUMNS column_range_list0
        { $$ = [ $2 ].concat( $3 ); }
    ;
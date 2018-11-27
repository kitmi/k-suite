/* Oolong Parser for Jison */

/* JS declaration */
%{
    //used to calculate the amount by bytes unit
    const UNITS = new Map([['K', 1024], ['M', 1048576], ['G', 1073741824], ['T', 1099511627776]]);

    //paired brackets
    const BRACKET_PAIRS = {
        '}': '{',
        ']': '[',
        ')': '('
    };

    //top level keywords
    const KEYWORDS_BY_LEVEL = [ 
        new Set(['import', 'type', 'const', 'schema', 'entity', 'dataset', 'view']), // level 0
        { // level 1
            'schema': new Set(['entities', 'views']),
            'entity': new Set(['with', 'has', 'key', 'index', 'data', 'interface']),
            'dataset': new Set(['contains', 'with'])
        }            
    ];
    
    //statements can be in one line
    const ONE_LINE_KEYWORDS = [ 
        new Set(['import', 'type', 'const', 'entity']), // level
        new Set(['key'])
    ];

    //indented child starting state
    const CHILD_KEYWORD_START_STATE = new Set([ 'EMPTY', 'DEDENTED' ]);
    
    const BUILTIN_TYPES = new Set([ 'any', 'array', 'binary', 'blob', 'bool', 'boolean', 'buffer', 'datetime', 'decimal', 'enum', 'float', 'int', 'integer', 'number', 'object', 'string', 'text', 'timestamp' ]);

    class ParserState {
        constructor() {
            this.indents = [];
            this.indent = 0;
            this.dedented = 0;
            this.eof = false;
            this.comment = false;
            this.brackets = [];
            this.state = {};
            this.stack = [];
        }

        get hasOpenBracket() {
            return this.brackets.length > 0;
        }

        get lastIndent() {
            return this.indents.length > 0 ? this.indents[this.indents.length - 1] : 0;
        }

        get hasIndent() {
            return this.indents > 0;
        }

        doIndent() {
            this.indents.push(this.indent);
        }

        doDedent() {
            this.dedented = 0;

            while (this.indents.length) {
                this.dedented++;
                this.indents.pop();
                if (this.lastIndent === this.indent) break;
            }

            if (this.lastIndent !== this.indent) {
                throw new Error('Cannot align to any of the previous indented block!');
            }

            if (this.dedented === 0) {
                throw new Error('Inconsistent indentation!');
            }
        }

        dedentAll() {
            this.indent = 0;
            this.dedented = this.indents.length;
            this.indents = [];
        }

        dump(loc) {
            console.log(loc);
            console.log('indents:', this.indents.join(' -> '));
            console.log('current indent:', this.indent, 'current dedented:', this.dedented);            
            console.log('comment:', this.comment, 'eof:', this.eof, 'brackets:', this.brackets.join(' -> '),'stack:', this.stack.join(' -> '));
            console.log();
            return this;
        }

        void() {
            return undefined;
        }

        val(value) {
            return value;
        }

        enterObject() {
            return this.enterState('object');
        }

        exitObject() {
            return this.exitState('object');
        }

        enterArray() {
            return this.enterState('array');
        }

        exitArray() {
            return this.exitState('array');
        }

        get lastState() {
            return this.stack.length > 0 ? this.stack[this.stack.length - 1] : undefined;
        }

        enterState(state) {
            this.stack.push(state);
            return this;
        }

        exitState(state) {
            let last = this.stack.pop();
            if (state !== last) {
                throw new Error(`Unmatched "${state}" state!`);
            }

            return this;
        }

        parseSize(size) {
            if (UNITS.has(size.substr(-1))) {
                let unit = size.substr(-1);
                let factor = UNITS[unit];
        
                size = size.substr(0, size.length - 1);
        
                return parseInt(size) * factor;
            } else {
                return parseInt(size);
            }
        }
        
        unquoteString(str, quotes) {
            return str.substr(quotes, str.length-quotes*2);
        }                
        
        normalizeReference(ref) {
            return { oolType: 'ObjectReference', name: ref.substr(1) };
        }

        normalizeConstReference(ref) {
            return { oolType: 'ConstReference', name: ref };
        }

        normalizeStringTemplate(text) {
            return { oolType: 'StringTemplate', value: this.unquoteString(text, 1) };
        }    

        normalizeValidator(name, args) {
            if (args) {
                return { oolType: 'Validator', name, args };
            } 
                
            return { oolType: 'Validator', name  };
        }

        normalizeProcessor(name, args) {
            if (args) {
                return { oolType: 'Processor', name, args };
            } 
                
            return { oolType: 'Processor', name  };
        }

        normalizeActivator(name, args) {
            if (args) {
                return { oolType: 'Activator', name, args };
            } 
                
            return { oolType: 'Activator', name  };
        }

        normalizePipedValue(value, modifiers) {
            return Object.assign({ oolType: 'PipedValue', value }, modifiers);
        }

        normalizeFunctionCall(func) {
            return Object.assign({ oolType: 'FunctionCall' }, func);
        }

        isTypeExist(type) {
            return this.state.type && (type in this.state.type);
        }    

        validate() {
            let errors = [];

            if (errors && errors.length > 0) {
                throw new Error(errors.join("\n"));
            }

            return this;
        }

        build() {
            return this.state;
        }

        import(namespace) {
            if (!this.state.namespace) {
                this.state.namespace = [];
            }

            this.state.namespace.push(namespace);
        }  
        
        define(type, name, value, line) {
            if (!this.state[type]) {
                this.state[type] = {};
            }

            if (name in this.state[type]) {
                throw new Error(`Duplicate ${type} definition detected at line ${line}.`);
            }

            this.state[type][name] = value;
        }

        defineConstant(name, value, line) {
            this.define('constant', name, value, line);
        }

        defineType(name, value, line) {
            if (!value.type) {
                throw new Error(`Missing type property for type "${name}" at line: ${line}!`);
            }

            this.define('type', name, value, line);
        }

        isTypeExist(type) {
            return this.state.type && (type in this.state.type);
        }
        
        defineEntity(name, value, line) {
            this.define('entity', name, value, line);
        }

        isEntityExist(entity) {
            return this.state.entity && (entity in this.state.entity);
        }

        addToEntity(name, extra) {
            if (!this.isEntityExist(name)) {
                throw new Error(`Entity "${name}" not exists.`);
            }

            Object.assign(this.state.entity[name], extra);
        }

        defineSchema(name, value, line) {
            this.define('schema', name, value, line);    
        }

        defineRelation(name, value, line) {
            this.define('relation', name, value, line);    
        }

        defineView(name, value, line) {
            this.define('view', name, value, line);
        }

        defineDataset(name, value, line) {
            this.define('dataset', name, value, line);
        }
    }

    var KEYWORDS = new Set([        
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

    var state; // created on start
%}

%lex

%options easy_keyword_rules
%options flex

uppercase               [A-Z]
lowercase               [a-z]
digit                   [0-9]

space           		\ |\t
newline		            \n|\r\n|\r|\f

// identifiers
element_access          {variable}"["({space})*?({variable}|{shortstring}|{integer})({space})*?"]"
member_access           {identifier}("."{identifier})+
column_range            {variable}".""*"
variable                {member_access}|{identifier}
object_reference        "@"{variable}

identifier              ({id_start})({id_continue})*
id_start                "_"|({uppercase})|({lowercase})
id_continue             {id_start}|{digit}

bool_value              "true"|"false"|"yes"|"no"|"on"|"off"

// numbers 
bytes                   {integer}("B"|"b")
bit_integer             {integer}("K"|"M"|"G"|"T")
big_integer             {integer}"n"
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
syntax_operators        "~"|","|":"|"|>"|"--"|"->"|"=>"|"<->"|"<-"
comment_operators       "//"
relation_operators      "!="|">="|"<="|">"|"<"|"="
logical_operators       "not"|"and"|"or"|"xor"
math_operators          "+"|"-"|"*"|"/"
math_operators2         "mod"|"div"
relation_operators2     "in"|"is"|"like"

// javascript
javascript              "<js>"{longstringitem}*?"</js>"
block_comment           "/*"{longstringitem}*?"*/"

// strings
jststring               "`"{longstringitem}*?"`"

longstring              {longstring_double}|{longstring_single}
longstring_double       '"""'{longstringitem}*?'"""'
longstring_single       "'''"{longstringitem}*?"'''"
longstringitem          {longstringchar}|{escapeseq}
longstringchar          [^\\]

shortstring             {shortstring_double}|{shortstring_single}
shortstring_double      '"'{shortstringitem_double}*?'"'
shortstring_single      "'"{shortstringitem_single}*?"'"
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
%s INITIAL EMPTY DEDENTED INLINE

%%

<INITIAL><<EOF>>        return 'EOF';

<INITIAL>.|\n           %{  //start the program
                            state = new ParserState();
                            this.unput(yytext);
                            this.begin('EMPTY');
                        %}

<EMPTY><<EOF>>          %{ 
                            if (state.indents.length > 0) {
                                //reach end-of-file, but a current block still not in ending state

                                //put back the eof
                                this.unput(' ');

                                //dedent all
                                state.dedentAll();
                                state.eof = true;
                                state.dump('<EMPTY><<EOF>>');
                                this.begin('DEDENTED');

                            } else {          
                                state.dump('<EMPTY><<EOF>>');                      
                                return 'EOF';
                            }
                        %}
<EMPTY>\                %{ state.indent++; %}
<EMPTY>\t               %{ state.indent = (state.indent + 8) & -7; %}
<EMPTY>\n               %{ state.indent = 0; if (state.comment) state.comment = false; %} // blank line
<EMPTY,INLINE>{comment_operators}.*      %{ state.comment = true; %} /* skip comments */
<EMPTY,INLINE>{block_comment}  %{  /* skip comments */ %}
<EMPTY>.                %{
                            this.unput( yytext )
                            //compare the current indents with the last
                            var last = state.lastIndent;
                            if (state.indent > last) {
                                //new indent
                                state.doIndent();
                                this.begin('INLINE');
                                state.dump('<EMPTY>. indent');                                                            
                                return 'INDENT';

                            } else if (state.indent < last) {
                                //dedent
                                state.doDedent();
                                this.begin('DEDENTED');  

                                state.dump('<EMPTY>. dedent');                                                            

                            } else {
                                //same indent
                                this.begin('INLINE');

                                if (!state.hasIndent) {
                                    if (state.lastState === 'type.info') {
                                        state.exitState('type.info');
                                    }

                                    if (state.lastState === 'type.name') {
                                        state.exitState('type.name');
                                    }

                                    if (ONE_LINE_KEYWORDS[0].has(state.lastState)) {
                                        state.exitState(state.lastState);
                                    }     
                                }                                                                                

                                state.dump('<EMPTY>. same');                                       
                            }
                        %}
<DEDENTED>.|<<EOF>>     %{
                            if (state.dedented > 0 && state.dedented-- > 0) {
                                this.unput(yytext);                                        

                                if (state.lastState === 'type.info') {
                                    state.exitState('type.info');
                                }  

                                if (state.lastState === 'type.name') {
                                    state.exitState('type.name');
                                }  
                                
                                if (state.lastState) {
                                    state.exitState(state.lastState);                      
                                }
                                
                                state.dump('<DEDENTED>.|<<EOF>> DEDENT');
                                return 'DEDENT';

                            } else if (state.eof) {
                                this.popState();
                                state.dump('<DEDENTED>.|<<EOF>> pop');
                                while (state.lastState) {
                                    state.exitState(state.lastState);                      
                                }

                            } else {
                                if (state.indent === 0) {
                                    while (state.lastState) {
                                        state.exitState(state.lastState);                      
                                    }
                                }

                                state.dedented = 0;
                                this.unput(yytext);
                                this.begin('INLINE');
                                state.dump('<DEDENTED>.|<<EOF>> INLINE');
                            }
                        %}
<INLINE><<EOF>>         %{
                            if (state.indents.length > 0) {
                                //reach end-of-file, but a current block still not in ending state

                                //put back the eof
                                this.unput(' ');

                                //dedent all
                                state.dedentAll();
                                state.eof = true;
                                state.dump('<INLINE><<EOF>>');
                                this.begin('DEDENTED');
                                return 'NEWLINE';

                            } else {                                
                                state.dump('<INLINE><<EOF>>');   

                                if (state.lastState) {
                                    //stack not empty   
                                    if (state.lastState === 'type.info') {
                                        state.exitState('type.info');
                                    }  

                                    if (state.lastState === 'type.name') {
                                        state.exitState('type.name');
                                    }  
                                    
                                    if (state.lastState) {
                                        state.exitState(state.lastState);                      
                                    }                      

                                    //put back the eof
                                    this.unput(' ');
                                    state.eof = true;
                                    this.begin('EMPTY');
                                    return 'NEWLINE';
                                }

                                return 'EOF';
                            }
                        %}       
<INLINE>{javascript}    %{
                            yytext = yytext.substr(4, yytext.length-9).trim();
                            return 'SCRIPT';
                        %}

<INLINE>{jststring}     %{
                            yytext = state.normalizeStringTemplate(yytext);
                            return 'STRING';
                        %}

<INLINE>{longstring}    %{
                            yytext = state.unquoteString(yytext, 3);
                            return 'STRING';
                        %}
<INLINE>{shortstring}   %{
                            yytext = state.unquoteString(yytext, 1);
                            return 'STRING';
                        %}
<INLINE>{newline}       %{
                            // implicit line joining
                            if (!state.hasOpenBracket) {                                
                                this.begin('EMPTY');

                                if (state.comment) {
                                    state.comment = false;
                                }

                                state.dump('<INLINE>{newline}');
                                state.indent = 0;

                                return 'NEWLINE';
                            }
                        %}
<INLINE>{space}+       /* skip whitespace, separate tokens */
<INLINE>{regexp}        return 'REGEXP';
<INLINE>{floatnumber}   %{
                            yytext = parseFloat(yytext);
                            return 'FLOAT';
                        %}
<INLINE>{bit_integer}   %{
                            yytext = state.parseSize(yytext);
                            return 'INTEGER';
                        %}
<INLINE>{bytes}         %{                            
                            yytext = parseInt(yytext.substr(0, yytext.length - 1));
                            if (yytext[yytext.length - 1] === 'B') {
                                yytext *= 8;
                            }
                            return 'BITS';
                        %}
<INLINE>{integer}       %{
                            yytext = parseInt(yytext);
                            return 'INTEGER';
                        %}
<INLINE>{element_access}   %{                                
                                return 'ELEMENT_ACCESS';
                           %}                        
<INLINE>{member_access}    %{                                
                                return 'DOTNAME';
                           %}
<INLINE>{object_reference} %{
                                yytext = state.normalizeReference(yytext);
                                return 'REFERENCE';
                           %}
<INLINE>{column_range}     %{
                                return 'COLUMNS';
                           %}
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

                                    if (yytext == '{') {
                                        state.enterObject();
                                    } else if (yytext == '}') {
                                        state.exitObject();
                                    } else if (yytext == '[') {
                                        state.enterArray();
                                    } else if (yytext == ']') {
                                        state.exitArray();
                                    }

                                    return yytext;
                                %}
<INLINE>{bool_value}       %{
                                yytext = (yytext === 'true' || yytext === 'on' || yytext === 'yes');
                                return 'BOOL';
                           %}

<INLINE>{identifier}        %{        
                                if (!state.lastState) {
                                    if (KEYWORDS_BY_LEVEL[0].has(yytext)) {
                                        state.enterState(yytext);
                                        return yytext;
                                    }

                                    throw new Error(`Invalid syntax: ${yytext}`);
                                }       

                                state.dump(this.topState(1) + ' -> <INLINE>{identifier}');                                     

                                if (state.lastState === 'schema') {
                                    if (state.hasIndent && CHILD_KEYWORD_START_STATE.has(this.topState(1)) && KEYWORDS_BY_LEVEL[1]['schema'].has(yytext)) {
                                        state.enterState('schema.' + yytext);
                                        return yytext;
                                    }
                                } else if (state.lastState === 'type') {
                                    state.enterState('type.name');
                                    return 'NAME';
                                } else if (state.lastState === 'type.name') {
                                    state.enterState('type.info');

                                    if (BUILTIN_TYPES.has(yytext)) {                                        
                                        return yytext;
                                    }
                                } else if (state.lastState === 'entity') {                                    
                                    if (state.hasIndent && CHILD_KEYWORD_START_STATE.has(this.topState(1)) && KEYWORDS_BY_LEVEL[1]['entity'].has(yytext)) {
                                        state.enterState('entity.' + yytext);
                                        return yytext;
                                    } else if (!state.hasIndent && yytext === 'extends') {
                                        return yytext;
                                    } 
                                } else if (state.lastState === 'entity.index') {
                                    if (yytext === 'unique') return yytext;
                                }                        

                                return 'NAME';
                            %}
<INLINE>{symbol_operators}  return yytext;
<INLINE>{word_operators}    return yytext;

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
    : statement
    | statement input0
    ;

statement
    : import_statement    
    | const_statement
    | type_statement
    | schema_statement    
    | entity_statement
    ;

import_statement
    : "import" STRING NEWLINE -> state.dump('import').import($2) 
    | "import" NEWLINE INDENT import_statement_block DEDENT 
    ;

import_statement_block
    : STRING NEWLINE -> state.import($1)
    | STRING NEWLINE import_statement_block -> state.import($1)
    ;

const_statement
    : "const" const_statement_item NEWLINE
    | "const" NEWLINE INDENT const_statement_block DEDENT
    ;

const_statement_item
    : identifier "=" literal
        {
            state.defineConstant($1, $3, @1.first_line);   
        }
    ;

const_statement_block
    : const_statement_item NEWLINE
    | const_statement_item NEWLINE const_statement_block
    ;

schema_statement
    : "schema" identifier_or_string NEWLINE INDENT schema_statement_block DEDENT -> state.defineSchema($2, $5, @1.first_line)
    ;

schema_statement_block
    : comment_or_not schema_entities schema_views_or_not -> Object.assign({}, $1, $2, $3)
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
    : identifier_or_string NEWLINE -> [ $1 ]
    | identifier_or_string NEWLINE schema_views_block -> [ $1 ].concat($3)
    ;

type_statement
    : "type" type_statement_item NEWLINE
    | "type" NEWLINE INDENT type_statement_block DEDENT
    ;

type_statement_item
    /* 
    there are three kinds of modifiers: validator, processor and activator 
        validator: take subject as the first arg
        processor: take subject as the first arg
        activator: assign value to the subject
        activator should only appear before validator and processor
    */
    : identifier type_base type_info_or_not type_modifiers_or_not
        {            
            if (BUILTIN_TYPES.has($1)) throw new Error('Cannot use built-in type "' + $1 + '" as a custom type name. Line: ' + @1.first_line);
            // default as text
            state.defineType($1, Object.assign({type: 'text'}, $2, $3, $4));
        }
    ;

type_statement_block
    : type_statement_item NEWLINE
    | type_statement_item NEWLINE type_statement_block
    ;

type_base
    : ':' types -> $2
    ;

types
    : int_keyword -> { type: 'integer' }
    | number_keyword -> { type: 'number' }    
    | text_keyword -> { type: 'text' }
    | bool_keyword -> { type: 'boolean' }
    | binary_keyword -> { type: 'binary' }
    | datetime_keyword -> { type: 'datetime' }
    | 'any'  -> { type: 'any' }
    | 'enum' -> { type: 'enum' }
    | 'array' -> { type: 'array' }
    | 'object' -> { type: 'object' }
    | identifier_or_string -> { type: $1 }
    ;

int_keyword
    : 'int'
    | 'integer'
    ;

number_keyword
    : 'number'
    | 'float' 
    | 'decimal'
    ;

text_keyword
    : 'text'
    | 'string'
    ;    

bool_keyword
    : 'bool'
    | 'boolean'
    ;

binary_keyword
    : 'blob'
    | 'binary'
    | 'buffer'
    ;

datetime_keyword
    : 'datetime'
    | 'timestamp'
    ;    

type_info_or_not
    :
    | type_infos
    ;

type_infos
    : type_info
    | type_info type_infos -> Object.assign({}, $1, $2)
    ;

type_info
    : identifier -> { [$1]: true }
    | narrow_function_call -> { [$1.name]: $1.args  }
    ;    

type_modifiers_or_not
    : 
    | type_modifiers -> { modifiers: $1 }
    ;     

type_modifiers
    : type_modifier -> [ $1 ]
    | type_modifier type_modifiers -> [ $1 ].concat($2)
    ;

type_modifier
    : "~" identifier -> state.normalizeValidator($2)
    | "~" narrow_function_call -> state.normalizeValidator($2.name, $2.args)
    | "|>" identifier -> state.normalizeProcessor($2)
    | "|>" narrow_function_call -> state.normalizeProcessor($2.name, $2.args)
    | "=" identifier -> state.normalizeActivator($2)
    | "=" narrow_function_call -> state.normalizeActivator($2.name, $2.args)
    ;

entity_statement
    : entity_statement_header NEWLINE -> state.defineEntity($1[0], $1[1], @1.first_line)
    | entity_statement_header NEWLINE INDENT entity_statement_block DEDENT -> state.defineEntity($1[0], Object.assign({}, $1[1], $4), @1.first_line)
    ;

entity_statement_header
    : entity_statement_header0 -> [ $1, {} ]
    | entity_statement_header0 "extends" identifier_or_string -> [ $1, { base: $3 } ]
    ;

entity_statement_header0
    : "entity" identifier_or_string -> $2
    ;

entity_statement_block
    : comment_or_not with_features_or_not has_fields_or_not key_or_not index_or_not data_or_not -> Object.assign({}, $1, $2, $3, $4, $5, $6)
    ;

comment_or_not
    :
    | "--" STRING NEWLINE -> { comment: $2 }
    ;

with_features_or_not
    :
    | with_features
    ;

has_fields_or_not
    :
    | has_fields
    ;

key_or_not
    :
    | key_statement
    ;

index_or_not
    :
    | index_statement
    ;

data_or_not
    :
    | data_statement
    ;

interfaces_or_not
    :
    | interfaces_statement
    ;

with_features
    : "with" feature_inject NEWLINE -> { features: [ $2 ] }
    | "with" NEWLINE INDENT with_features_block DEDENT -> { features: $4 }
    ;

with_features_block
    : feature_inject NEWLINE -> [ $1 ]
    | feature_inject NEWLINE with_features_block -> [ $1 ].concat($3)
    ;

has_fields
    : "has" field_item NEWLINE -> { fields: { [$2.name]: $2 } }
    | "has" NEWLINE INDENT has_fields_block DEDENT -> { fields: $4 }
    ;

field_item
    : field_item_body field_comment_or_not -> Object.assign({}, $1, $2)
    ;

has_fields_block
    : field_item NEWLINE -> { [$1.name]: $1 }
    | field_item NEWLINE has_fields_block -> Object.assign({}, { [$1.name]: $1 }, $3)
    ;

field_comment_or_not
    :
    | "--" STRING -> { comment: $2 }
    ;    

field_item_body
    : modifiable_param
    | identifier_or_string field_assoc type_info_or_not -> Object.assign({ name: $1 }, $2, $3)
    ;

field_assoc
    : "->" identifier_or_string -> { association: { type: 'hasOne', entity: $2 } }  /* hasOne */
    | "=>" identifier_or_string -> { association: { type: 'belongsTo', entity: $2 } } /* belongsTo */
    | "->" "[" identifier_or_string "]" -> { association: { type: 'hasMany', entity: $3 } }  /* hasMany */
    ; 

type_base_or_not
    :
    | type_base
    ;    

field_modifiers_or_not
    : 
    | field_modifiers -> { modifiers: $1 }
    ;     

field_modifiers
    : field_modifier -> [ $1 ]
    | field_modifier field_modifiers -> [ $1 ].concat($2)
    ;

field_modifier
    : "~" identifier -> state.normalizeValidator($2)
    | "~" general_function_call -> state.normalizeValidator($2.name, $2.args)
    | "|>" identifier -> state.normalizeProcessor($2)
    | "|>" general_function_call -> state.normalizeProcessor($2.name, $2.args)
    | "=" identifier -> state.normalizeActivator($2)
    | "=" general_function_call -> state.normalizeActivator($2.name, $2.args)
    ;    

key_statement
    : "key" identifier_or_string NEWLINE -> { key: $2 }
    | "key" array_of_identifier_or_string NEWLINE -> { key: $2 }
    ;

index_statement
    : "index" index_item NEWLINE -> { indexes: [$2] }
    | "index" NEWLINE INDENT index_statement_block DEDENT -> { indexes: $4 }
    ;

index_statement_block
    : index_item NEWLINE -> [ $1 ]
    | index_item NEWLINE index_statement_block -> [ $1 ].concat($3)
    ;

index_item
    : index_item_body
    | index_item_body "unique" -> Object.assign({}, $1, { unique: true })
    ;

index_item_body
    : identifier_or_string -> { fields: $1 }
    | array_of_identifier_or_string -> { fields: $1 }
    ;

data_statement
    : "data" inline_object NEWLINE -> { data: $2 }
    | "data" inline_array NEWLINE -> { data: $2 }
    ;
/*
interfaces_statement
    : "interface" NEWLINE INDENT interfaces_statement_block DEDENT -> { interfaces: $4 }
    ;

interfaces_statement_block
    : interface_definition -> Object.assign({}, $1)
    | interface_definition interfaces_statement_block -> Object.assign({}, $1, $2)
    ;

interface_definition
    : identifier_or_string NEWLINE INDENT interface_definition_body DEDENT -> { [$1]: $4 }
    ;

interface_definition_body
    : accept_or_not implementation return_or_not -> Object.assign({}, $1, { implementation: $2 }, $3)
    ;
*/    

accept_or_not
    :
    | accept_statement
    ;

accept_statement
    : "accept" modifiable_param NEWLINE -> { accept: [ $2 ] }
    | "accept" NEWLINE INDENT accept_block DEDENT -> { accept: $4 }
    ;

accept_block
    : modifiable_param NEWLINE -> [ $1 ]
    | modifiable_param NEWLINE accept_block -> [ $1 ].concat($3)
    ;

/*
implementation
    : operation -> [ $1 ]
    | operation implementation -> [ $1 ].concat($2)
    ;

operation
    : find_one_operation
    | find_list_operation
    | update_operation
    | create_operation
    | delete_operation
    | coding_block
    | assign_operation   
    ;

find_one_operation
    : "find" article_keyword identifier_or_string selection_keyword condition_as_result_expression -> { oolType: 'findOne', model: $3, condition: $5 }
    ;

case_statement
    : "below" "cases" NEWLINE INDENT case_condition_block otherwise_or_not DEDENT
    ;

otherwise_or_not
    :
    | otherwise_keywords condition_as_result_expression
    | otherwise_keywords stop_controll_flow_expression
    ;

otherwise_keywords
    : "otherwise"
    | "else"
    ;          

stop_controll_flow_expression
    : return_expression
    | throw_error_expression
    ;

condition_as_result_expression
    : 
    | 
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
*/

dataset_statement
    : "dataset" identifier_or_string NEWLINE INDENT dataset_statement_block DEDENT -> state.defineDataset($2, $5)
    ;

dataset_statement_block
    : "contains" identifier_or_string NEWLINE -> { entity: $2 }
    | "contains" identifier_or_string NEWLINE dataset_statement_block2 -> { entity: $2, joinWith: $4 }
    ;

dataset_statement_block2
    : "with" document_entity_join NEWLINE -> [ $2 ]
    | "with" document_entity_join NEWLINE dataset_statement_block2 -> [ $2 ].concat($4)
    ;

dataset_entity_join
    : identifier_or_string "being" identifier_string_or_dotname -> { entity: $1, on: { left: $3, right: '$key' } }
    | identifier_or_string "dataset" "of" "which" identifier_string_or_dotname "being" identifier_string_or_dotname -> { dataset: $1, on: { left: $7, right: $5 } }
    ;    

view_statement
    : "view" identifier_or_string NEWLINE INDENT view_statement_block DEDENT -> state.defineView($2, $5)
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
    : "is" article_keyword view_entity_target -> $3
    | "is" article_keyword view_entity_target "list" -> Object.assign({}, $3, { isList: true })
    ;

view_entity_target
    : identifier_or_string -> { entity: $1 }
    | identifier_or_string "dataset" -> { dataset: $1 }
    ;

view_selection_or_not
    :
    | view_selection
    ;

view_selection
    : selection_keyword conditional_expression NEWLINE -> { where: [ $2 ] }
    | selection_keyword NEWLINE INDENT view_selection_block DEDENT -> { where: $4 }
    ;

article_keyword
    : "a"
    | "an"
    | "the"
    | "one"
    ;    

selection_keyword
    : "which" "has"
    | "where" "is"
    | "when" "to" "be"
    | "selected" "by"
    | "with"
    ;    

view_selection_block
    : conditional_expression NEWLINE -> [ $1 ]
    | conditional_expression NEWLINE view_selection_block -> [ $1 ].concat($3)
    ;

group_by_or_not
    :
    | "group" "by" identifier_string_or_dotname_list NEWLINE -> { groupBy: $3 }
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
    : identifier_string_or_dotname -> { field: $1, ascend: true }
    | identifier_string_or_dotname "asc" -> { field: $1, ascend: true }
    | identifier_string_or_dotname "desc" -> { field: $1, ascend: false }
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

modifiable_param
    : identifier_or_string type_base_or_not type_info_or_not field_modifiers_or_not -> Object.assign({ name: $1, type: $1 }, $2, $3, $4)   
    ;

feature_inject
    : identifier
    | narrow_function_call
    ;

/* simple function call, without modifiable support */
narrow_function_call
    : identifier "(" nfc_param_list ")" -> { name: $1, args: $3 }
    ;    

nfc_param_list
    : nfc_param -> $1
    | nfc_param nfc_param_list0 -> [ $1 ].concat($2)
    ;

nfc_param_list0
    : ',' nfc_param -> [ $2 ]
    | ',' nfc_param nfc_param_list0 -> [ $2 ].concat($3)
    ;    

nfc_param
    : literal
    | identifier -> state.normalizeConstReference($1)
    ;

general_function_call
    : identifier "(" gfc_param_list ")" -> { name: $1, args: $3 }
    ;        

gfc_param_list
    : gfc_param -> $1
    | gfc_param gfc_param_list0 -> [ $1 ].concat($2)
    ;

gfc_param_list0
    : "," gfc_param -> [ $2 ]
    | "," gfc_param gfc_param_list0 -> [ $2 ].concat($3)
    ;    

gfc_param
    : gfc_param0
    | gfc_param0 field_modifiers -> state.normalizePipedValue($1, { modifiers: $2 })
    ;

gfc_param0
    : nfc_param
    | REFERENCE
    ;    

identifier_string_or_dotname
    : identifier
    | STRING
    | DOTNAME
    ;        

identifier_string_or_dotname_list
    : identifier_string_or_dotname -> $1
    | identifier_string_or_dotname identifier_string_or_dotname_list0 -> [ $1 ].concat($2) 
    ;

identifier_string_or_dotname_list0
    : "," identifier_string_or_dotname -> [ $2 ]
    | "," identifier_string_or_dotname identifier_string_or_dotname_list0 -> [ $2 ].concat($3)
    ;

identifier_or_string
    : identifier
    | STRING
    ;    

identifier
    : NAME
    ;

literal
    : INTEGER
    | FLOAT
    | BOOL
    | inline_object
    | inline_array
    | REGEXP
    | STRING
    | SCRIPT
    ;    

inline_object
    : "{" "}" -> {}
    | "{" kv_pairs "}" -> $2
    ;

kv_pair_item
    : identifier_or_string ":" value -> {[$1]: $3}
    | INTEGER ":" value -> {[$1]: $3}
    ;

kv_pairs
    : kv_pair_item
    | kv_pair_item kv_pairs0 -> Object.assign({}, $1, $2)
    ;

kv_pairs0
    : "," kv_pair_item -> $2
    | "," kv_pair_item kv_pairs0 -> Object.assign({}, $2, $3)
    ;

inline_array
    : "[" "]" -> []
    | "[" value_list "]" -> $2
    ;

value_list
    : value -> [ $1 ]
    | value value_list0 -> [ $1 ].concat($2)
    ;

value_list0
    : ',' value -> [ $2 ]
    | ',' value value_list0 -> [ $2 ].concat($3)
    ;    

array_of_identifier_or_string
    : "[" identifier_or_string_list "]" -> $2
    ;

identifier_or_string_list
    : identifier_or_string -> [ $1 ]
    | identifier_or_string identifier_or_string_list0 -> [ $1 ].concat($2)
    ;

identifier_or_string_list0
    : ',' identifier_or_string -> [ $2 ]
    | ',' identifier_or_string identifier_or_string_list0 -> [ $2 ].concat($3)
    ;        

value
    : nfc_param
    | narrow_function_call -> state.normalizeFunctionCall($1)
    ;

conditional_expression
    : simple_expression
    | logical_expression
    ;

simple_expression
    : unary_expression
    | binary_expression
    | "(" simple_expression ")" -> $2
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
    : simple_expression logical_expression_right -> Object.assign({ left: $1 }, $2)
    | "(" logical_expression ")" -> $2
    ;

logical_expression_right
    : logical_operators simple_expression -> Object.assign({ oolType: 'BinaryExpression' }, $1, { right: $2 })
    ;

logical_operators
    : "and" -> { operator: 'and' }
    | "or" -> { operator: 'or' }
    ;

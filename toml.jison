%lex

datetime      \d{4}"-"\d{2}"-"\d{2}"T"\d{2}":"\d{2}":"\d{2}"Z"

%%

\s+                         /* ignore whitespace */
'true'                      return 'TRUE'
'false'                     return 'FALSE'
{datetime}                  return 'DATETIME'
\"([^"\\]|\\.)*\"           return 'STR'
'='                         return 'EQUALS'
"#".*                       return 'COMMENT'
[0-9]+"."[0-9]+             return 'FLOAT'
[0-9]+                      return 'INTEGER'
'-'                         return '-'
'['                         return '['
']'                         return ']'
','                         return ','
[^\"\s=\[\]]+               return 'IDENTIFIER'
<<EOF>>                     return 'EOF'

/lex

%start file

%%

file
    : lines { return parser.toml.data; }
    ;

lines
    : line { $$ = $1 }
    | lines line
    ;

line
    : comment
    | keygroup
    | assignment
    | line EOF
    ;

comment
    : COMMENT
    ;

assignment
    : identifier EQUALS value { parser.toml.set($identifier, $value); }
    ;

identifier
    : IDENTIFIER { $$ = $1 }
    ;

keygroup
    : '[' keygroupid ']'  { parser.toml.currentGroup = $keygroupid; }
    ;

keygroupid
    : identifier
    | keygroupid '.' identifier
    ;

value
    : STR       { $$ = parseString($1) }
    | float     { $$ = $1 }
    | integer   { $$ = $1 }
    | bool      { $$ = $1 }
    | DATETIME  { $$ = new Date($1) }
    | array     { $$ = $1 }
    ;

integer
    : INTEGER { $$ = parseInt($1, 10); }
    | '-' integer { $$ = $2 * -1 }
    ;

float
    : FLOAT { $$ = parseFloat($1, 10); }
    | '-' float { $$ = $2 * -1 }
    ;

array
    : '[' arrayelem ']' { $$ = $arrayelem }
    ;

arrayelem
    : value { $$ = [$1] }
    | arrayelem ',' value { $arrayelem.push($value) }
    ;

bool
    : TRUE  { $$ = true; }
    | FALSE { $$ = false; }
    ;

%%

function parseString(str) {
  var str = str.substr(1, str.length - 2);
  str = str.replace(/([^\\])\\0/g, "$1\0")
           .replace(/([^\\])\\n/g, "$1\n")
           .replace(/([^\\])\\t/g, "$1\t")
           .replace(/([^\\])\\r/g, "$1\r")
           .replace(/([^\\])\\"/g, "$1\"")
           .replace(/\\\\/g, "\\")
  return str;
}

function deepSet(obj, path, value) {
  var tags = path.split("."), len = tags.length - 1;
  for (var i = 0; i < len; i++) {
    obj[tags[i]] = obj[tags[i]] || {};
    obj = obj[tags[i]];
  }
  obj[tags[len]] = value;
}

parser.toml = {
  data: {},
  currentGroup: null,
  set: function(key, value) {
    if (this.currentGroup) {
      key = this.currentGroup + "." + key;
    }
    deepSet(this.data, key, value);
  }
};

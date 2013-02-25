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
    : lines { return this.toml.data; }
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
    : identifier EQUALS value { this.toml = set(this.toml, $identifier, $value); }
    ;

identifier
    : IDENTIFIER { $$ = $1 }
    ;

keygroup
    : '[' keygroupid ']'  { this.toml = setCurrentGroup(this.toml, $keygroupid); }
    ;

keygroupid
    : identifier
    | keygroupid '.' identifier
    ;

value
    : string
    | float
    | integer
    | bool
    | datetime
    | array
    ;

string
    : STR { $$ = parseString($1) }
    ;

datetime
    : DATETIME { $$ = new Date($1) }
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
    : '[' strarray ']'      { $$ = $2 }
    | '[' floatarray ']'    { $$ = $2 }
    | '[' integerarray ']'  { $$ = $2 }
    | '[' boolarray ']'     { $$ = $2 }
    | '[' datetimearray ']' { $$ = $2 }
    | '[' arrayarray ']'    { $$ = $2 }
    ;

strarray
    : string { $$ = [$1] }
    | strarray ',' string { $1.push($3) }
    | strarray ','
    ;

floatarray
    : float { $$ = [$1] }
    | floatarray ',' float { $1.push($3) }
    | floatarray ','
    ;

integerarray
    : integer { $$ = [$1] }
    | integerarray ',' integer { $1.push($3) }
    | integerarray ','
    ;

boolarray
    : bool { $$ = [$1] }
    | boolarray ',' bool { $1.push($3) }
    | boolarray ','
    ;

datetimearray
    : datetime { $$ = [$1] }
    | datetimearray ',' datetime { $1.push($3) }
    | datetimearray ','
    ;

arrayarray
    : array { $$ = [$1] }
    | arrayarray ',' array { $1.push($3) }
    | arrayarray ','
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

function deepValue(obj, path, value) {
  var tags = path.split("."), len = tags.length - 1;
  for (var i = 0; i < len; i++) {
    obj[tags[i]] = obj[tags[i]] || {};
    obj = obj[tags[i]];
  }
  if (value !== undefined)
    obj[tags[len]] = value;
  else
    return obj[tags[len]]
}

function set(instance, key, value) {
  instance = instance || new TomlInstance();
  instance.set(key, value);
  return instance;
}

function setCurrentGroup(instance, group) {
  instance = instance || new TomlInstance();
  instance.setCurrentGroup(group);
  return instance;
}

function TomlInstance() {
  this.data = {};
  this.currentGroup = null;
};

TomlInstance.prototype = {
  setCurrentGroup: function(group) {
    if (deepValue(this.data, group))
      throw new Error("Cannot overrite previously set key " + group + " with keygroup");
    this.currentGroup = group;
  },
  set: function(key, value) {
    if (this.currentGroup)
      key = this.currentGroup + '.' + key;
    deepValue(this.data, key, value);
  },
};

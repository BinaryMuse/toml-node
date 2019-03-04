// This grammar assumes \r\n has been normalized to \n.

{
  var nodes = [];

  function genError(err, line, col) {
    var ex = new Error(err);
    ex.line = line;
    ex.column = col;
    throw ex;
  }

  function addNode(node) {
    nodes.push(node);
  }

  function node(type, value, line, column, key) {
    var obj = { type: type, value: value, line: line(), column: column() };
    if (key) obj.key = key;
    return obj;
  }

  function convertCodePoint(str, line, col) {
    var num = parseInt("0x" + str);

    if (
      !isFinite(num) ||
      Math.floor(num) != num ||
      num < 0 ||
      num > 0x10FFFF ||
      (num > 0xD7FF && num < 0xE000)
    ) {
      genError("Invalid Unicode escape code: " + str, line, col);
    } else {
      return fromCodePoint(num);
    }
  }

  function fromCodePoint() {
    var MAX_SIZE = 0x4000;
    var codeUnits = [];
    var highSurrogate;
    var lowSurrogate;
    var index = -1;
    var length = arguments.length;
    if (!length) {
      return '';
    }
    var result = '';
    while (++index < length) {
      var codePoint = Number(arguments[index]);
      if (codePoint <= 0xFFFF) { // BMP code point
        codeUnits.push(codePoint);
      } else { // Astral code point; split in surrogate halves
        // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        codePoint -= 0x10000;
        highSurrogate = (codePoint >> 10) + 0xD800;
        lowSurrogate = (codePoint % 0x400) + 0xDC00;
        codeUnits.push(highSurrogate, lowSurrogate);
      }
      if (index + 1 == length || codeUnits.length > MAX_SIZE) {
        result += String.fromCharCode.apply(null, codeUnits);
        codeUnits.length = 0;
      }
    }
    return result;
  }
}

start
  = line*                               { return nodes }

line
  = WS ( expression WS comment? "\n"?
       / comment "\n"?
       / "\n" )

comment
  = '#' [^\n]*

expression
  = path / tablearray / assignment

path
  = '[' name:table_key ']'              { addNode(node('ObjectPath', name, line, column)) }

tablearray
  = '[[' name:table_key ']]'            { addNode(node('ArrayPath', name, line, column)) }

table_key
  = WS first:table_key_part
    WS rest:('.' WS part:table_key_part WS { return part })*
                                        { return [first].concat(rest) }

table_key_part
  = key / quoted_key

assignment
  = key:key WS '=' WS value:value       { addNode(node('Assign', value, line, column, key)) }
  / key:quoted_key WS '=' WS value:value { addNode(node('Assign', value, line, column, key)) }

key
  = ASCII_BASIC

quoted_key
  = double_quoted_single_line_string
  / single_quoted_single_line_string

value
  = string / datetime / float / integer / boolean / array / inline_table

string
  = chars:( double_quoted_multiline_string
          / double_quoted_single_line_string
          / single_quoted_multiline_string
          / single_quoted_single_line_string )
                                        { return node('String', chars, line, column) }

double_quoted_multiline_string
  = '"""' "\n"?
    chars:multiline_string_chars
    '"""'                               { return chars.join('') }

double_quoted_single_line_string
  = '"' chars:( [^"\\] / ESCAPED )* '"' { return chars.join('') }

single_quoted_multiline_string
  = "'''" "\n"?
    chars:multiline_literal_chars
    "'''"                               { return chars.join('') }

single_quoted_single_line_string
  = "'" chars:[^']* "'"                 { return chars.join('') }

multiline_string_chars
  = ( [^"\\] / multiline_string_delim / ESCAPED / !'"""' c:. { return c } )*

multiline_string_delim
  = '\\\n' [ \t\n]*                     { return '' }

multiline_literal_chars
  = ( [^'] / !"'''" c:. { return c } )*

float
  = left:(float_text / integer_text) ('e' / 'E') right:integer_text { return node('Float', parseFloat(left + 'e' + right), line, column) }
  / text:float_text                                                 { return node('Float', parseFloat(text), line, column) }

float_text
  = '+'? digits:(DIGITS '.' DIGITS)     { return digits.join('') }
  / '-'  digits:(DIGITS '.' DIGITS)     { return '-' + digits.join('') }

integer
  = text:integer_text                   { return node('Integer', parseInt(text, 10), line, column) }

integer_text
  = '+'? digits:DIGITS !'.'             { return digits }
  / '-'  digits:DIGITS !'.'             { return '-' + digits }

boolean
  = 'true'                              { return node('Boolean', true, line, column) }
  / 'false'                             { return node('Boolean', false, line, column) }

array
  = '[' array_WS ']'                                   { return node('Array', [], line, column) }
  / '[' value:array_value? ']'                         { return node('Array', value ? [value] : [], line, column) }
  / '[' values:array_value_list+ ']'                   { return node('Array', values, line, column) }
  / '[' values:array_value_list+ value:array_value ']' { return node('Array', values.concat(value), line, column) }

array_value
  = array_WS value:value array_WS               { return value }

array_value_list
  = array_WS value:value array_WS ',' array_WS  { return value }

array_WS
  = WS ( comment? "\n" WS )*

inline_table
  = '{' WS values:inline_table_assignment* WS '}'   { return node('InlineTable', values, line, column) }

inline_table_assignment
  = WS key:key WS '=' WS value:value WS ',' WS      { return node('InlineTableValue', value, line, column, key) }
  / WS key:key WS '=' WS value:value                { return node('InlineTableValue', value, line, column, key) }

secfragment
  = '.' digits:DIGITS                               { return "." + digits }

date
  = date:(
      DIGIT DIGIT DIGIT DIGIT
      '-'
      DIGIT DIGIT
      '-'
      DIGIT DIGIT
    )                                                               { return date.join('') }

time
  = time:(DIGIT DIGIT ':' DIGIT DIGIT ':' DIGIT DIGIT secfragment?) { return time.join('') }

time_with_offset
  = time:(
      DIGIT DIGIT ':' DIGIT DIGIT ':' DIGIT DIGIT secfragment?
      ('-' / '+')
      DIGIT DIGIT ':' DIGIT DIGIT
    )                                                               { return time.join('') }

datetime
  = date:date 'T' time:time 'Z'               { return node('Date', new Date(date + "T" + time + "Z"), line, column) }
  / date:date 'T' time:time_with_offset       { return node('Date', new Date(date + "T" + time), line, column) }

WS               = [ \t]*
HEX              = [0-9a-f]i
DIGIT            = [0-9]

ASCII_BASIC      = [A-Za-z0-9_\-]+      { return text() }

DIGITS           = [0-9_]+              { return text().replace(/_/g, '') }

ESCAPED          = '\\"'                { return '"'  }
                 / '\\\\'               { return '\\' }
                 / '\\b'                { return '\b' }
                 / '\\t'                { return '\t' }
                 / '\\n'                { return '\n' }
                 / '\\f'                { return '\f' }
                 / '\\r'                { return '\r' }
                 / '\\U' digits:(HEX HEX HEX HEX HEX HEX HEX HEX)
                                        { return convertCodePoint(digits.join('')) }
                 / '\\u' digits:(HEX HEX HEX HEX)
                                        { return convertCodePoint(digits.join('')) }
                 / '\\'

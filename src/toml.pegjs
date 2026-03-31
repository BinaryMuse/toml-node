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

  function node(type, value, loc, key) {
    var obj = { type: type, value: value, line: loc.start.line, column: loc.start.column };
    if (key) obj.key = key;
    return obj;
  }

  function validateDate(dateStr, loc) {
    var parts = dateStr.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (month < 1 || month > 12) {
      genError("Invalid date: month " + month + " out of range.", loc.start.line, loc.start.column);
    }
    var maxDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
      maxDays[1] = 29;
    }
    if (day < 1 || day > maxDays[month - 1]) {
      genError("Invalid date: day " + day + " out of range for month " + month + ".", loc.start.line, loc.start.column);
    }
  }

  function validateTime(timeStr, loc) {
    var base = timeStr.split('.')[0];
    var parts = base.split(':');
    var hour = parseInt(parts[0], 10);
    var minute = parseInt(parts[1], 10);
    var second = parseInt(parts[2], 10);
    if (hour > 23) {
      genError("Invalid time: hour " + hour + " out of range.", loc.start.line, loc.start.column);
    }
    if (minute > 59) {
      genError("Invalid time: minute " + minute + " out of range.", loc.start.line, loc.start.column);
    }
    if (second > 59) {
      genError("Invalid time: second " + second + " out of range.", loc.start.line, loc.start.column);
    }
  }

  function validateOffset(offsetStr, loc) {
    if (offsetStr === "Z") return;
    var parts = offsetStr.substring(1).split(':');
    var hour = parseInt(parts[0], 10);
    var minute = parseInt(parts[1], 10);
    if (hour > 23) {
      genError("Invalid offset: hour " + hour + " out of range.", loc.start.line, loc.start.column);
    }
    if (minute > 59) {
      genError("Invalid offset: minute " + minute + " out of range.", loc.start.line, loc.start.column);
    }
  }

  function stripUnderscores(str) {
    return str.replace(/_/g, '');
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
  = S* expr:expression S* comment* (NL+ / EOF)
  / S+ (NL+ / EOF)
  / NL

expression
  = comment / path / tablearray / assignment

comment
  = '#' (!(NL / EOF) .)*

path
  = '[' S* name:table_key S* ']'              { addNode(node('ObjectPath', name, location())) }

tablearray
  = '[' '[' S* name:table_key S* ']' ']'      { addNode(node('ArrayPath', name, location())) }

table_key
  = parts:dot_ended_table_key_part+ name:table_key_part    { return parts.concat(name) }
  / name:table_key_part                                    { return [name] }

table_key_part
  = S* name:key S*                      { return name }
  / S* name:quoted_key S*               { return name }

dot_ended_table_key_part
  = S* name:key S* '.' S*               { return name }
  / S* name:quoted_key S* '.' S*        { return name }

assignment
  = keys:inline_key S* '=' S* value:value { addNode(node('Assign', value, location(), keys)) }

key
  = chars:ASCII_BASIC+ { return chars.join('') }

quoted_key
  = node:double_quoted_single_line_string { return node.value }
  / node:single_quoted_single_line_string { return node.value }

value
  = string / datetime / float / integer / boolean / array / inline_table

string
  = double_quoted_multiline_string
  / double_quoted_single_line_string
  / single_quoted_multiline_string
  / single_quoted_single_line_string

double_quoted_multiline_string
  = '"""' NL? chars:multiline_string_char* '"""'  { return node('String', chars.join(''), location()) }
double_quoted_single_line_string
  = '"' chars:string_char* '"'                    { return node('String', chars.join(''), location()) }
single_quoted_multiline_string
  = "'''" NL? chars:multiline_literal_char* "'''" { return node('String', chars.join(''), location()) }
single_quoted_single_line_string
  = "'" chars:literal_char* "'"                   { return node('String', chars.join(''), location()) }

string_char
  = ESCAPED / (!'"' char:. { return char })

literal_char
  = (!"'" char:. { return char })

multiline_string_char
  = ESCAPED / multiline_string_delim / (!'"""' char:. { return char})

multiline_string_delim
  = '\\' NL NLS*                        { return '' }

multiline_literal_char
  = (!"'''" char:. { return char })

float
  = sign:[+-]? 'inf'                                  { return node('Float', sign === '-' ? -Infinity : Infinity, location()) }
  / sign:[+-]? 'nan'                                  { return node('Float', NaN, location()) }
  / left:float_or_int_text [eE] right:float_exp_text  { return node('Float', parseFloat(stripUnderscores(left + 'e' + right)), location()) }
  / text:float_text                                   { return node('Float', parseFloat(stripUnderscores(text)), location()) }

float_text
  = sign:[+-]? digits:FLOAT_DEC_INT '.' frac:DEC_INT  { return (sign === '-' ? '-' : '') + digits + '.' + frac }

float_or_int_text
  = sign:[+-]? digits:FLOAT_DEC_INT '.' frac:DEC_INT  { return (sign === '-' ? '-' : '') + digits + '.' + frac }
  / sign:[+-]? digits:FLOAT_DEC_INT                    { return (sign === '-' ? '-' : '') + digits }

// Integer part of floats follows same no-leading-zero rule as integers
FLOAT_DEC_INT
  = '0' { return '0' }
  / DEC_INT_NOZERO

float_exp_text
  = sign:[+-]? digits:DEC_INT                          { return (sign || '') + digits }

integer
  = '0x' digits:HEX_INT                               { return node('Integer', parseInt(stripUnderscores(digits), 16), location()) }
  / '0o' digits:OCT_INT                                { return node('Integer', parseInt(stripUnderscores(digits), 8), location()) }
  / '0b' digits:BIN_INT                                { return node('Integer', parseInt(stripUnderscores(digits), 2), location()) }
  / text:dec_integer_text                              { return node('Integer', parseInt(stripUnderscores(text), 10), location()) }

dec_integer_text
  = sign:[+-]? '0' !([0-9_]) !'.'                     { return (sign || '') + '0' }
  / sign:[+-]? digits:DEC_INT_NOZERO !'.'             { return (sign || '') + digits }

DEC_INT_NOZERO
  = head:[1-9] tail:([_]? [0-9])* { return head + tail.map(function(p) { return p.join('') }).join('') }

// Digit sequences with underscore validation:
// - Underscores must be between digits (not leading, trailing, or consecutive)
DEC_INT
  = head:[0-9] tail:([_]? [0-9])* { return head + tail.map(function(p) { return p.join('') }).join('') }

HEX_INT
  = head:[0-9a-fA-F] tail:([_]? [0-9a-fA-F])* { return head + tail.map(function(p) { return p.join('') }).join('') }

OCT_INT
  = head:[0-7] tail:([_]? [0-7])* { return head + tail.map(function(p) { return p.join('') }).join('') }

BIN_INT
  = head:[01] tail:([_]? [01])* { return head + tail.map(function(p) { return p.join('') }).join('') }

boolean
  = 'true'                              { return node('Boolean', true, location()) }
  / 'false'                             { return node('Boolean', false, location()) }

array
  = '[' array_sep* ']'                                 { return node('Array', [], location()) }
  / '[' value:array_value? ']'                         { return node('Array', value ? [value] : [], location()) }
  / '[' values:array_value_list+ ']'                   { return node('Array', values, location()) }
  / '[' values:array_value_list+ value:array_value ']' { return node('Array', values.concat(value), location()) }

array_value
  = array_sep* value:value array_sep*                  { return value }

array_value_list
  = array_sep* value:value array_sep* ',' array_sep*   { return value }

array_sep
  = S / NL / comment

inline_table
  = '{' S* '}'                                                            { return node('InlineTable', [], location()) }
  / '{' S* entries:inline_table_entry_list S* last:inline_table_entry S* '}' { return node('InlineTable', entries.concat(last), location()) }
  / '{' S* entry:inline_table_entry S* '}'                                { return node('InlineTable', [entry], location()) }

inline_table_entry_list
  = entries:(S* e:inline_table_entry S* ',' { return e })+                { return entries }

inline_table_entry
  = keys:inline_key S* '=' S* value:value                                { return node('InlineTableValue', value, location(), keys) }

inline_key
  = parts:inline_dot_key_part+ S* last:simple_key                        { return parts.concat(last) }
  / k:simple_key                                                         { return [k] }

inline_dot_key_part
  = S* k:simple_key S* '.'                                               { return k }

simple_key
  = key
  / quoted_key

secfragment
  = '.' digits:DIGIT+                                  { return "." + digits.join('') }

date_part
  = d:(DIGIT DIGIT DIGIT DIGIT '-' DIGIT DIGIT '-' DIGIT DIGIT)  { return d.join('') }

time_part
  = t:(DIGIT DIGIT ':' DIGIT DIGIT ':' DIGIT DIGIT secfragment?) { return t.join('') }

offset
  = 'Z'i                                              { return "Z" }
  / sign:[+-] h:(DIGIT DIGIT) ':' m:(DIGIT DIGIT)     { return sign + h.join('') + ":" + m.join('') }

datetime_delim
  = 'T'i / ' '

datetime
  = d:date_part datetime_delim t:time_part o:offset    { validateDate(d, location()); validateTime(t, location()); validateOffset(o, location()); return node('Date', new Date(d + "T" + t + o), location()) }
  / d:date_part datetime_delim t:time_part             { validateDate(d, location()); validateTime(t, location()); return node('LocalDateTime', d + "T" + t, location()) }
  / d:date_part !datetime_delim                         { validateDate(d, location()); return node('LocalDate', d, location()) }
  / t:time_part                                        { validateTime(t, location()); return node('LocalTime', t, location()) }


S                = [ \t]
NL               = "\n" / "\r" "\n"
NLS              = NL / S
EOF              = !.
DIGIT            = [0-9]
HEX              = [0-9a-fA-F]
ASCII_BASIC      = [A-Za-z0-9_\-]
ESCAPED          = '\\"'                { return '"'  }
                 / '\\\\'               { return '\\' }
                 / '\\b'                { return '\b' }
                 / '\\t'                { return '\t' }
                 / '\\n'                { return '\n' }
                 / '\\f'                { return '\f' }
                 / '\\r'                { return '\r' }
                 / ESCAPED_UNICODE
ESCAPED_UNICODE  = "\\U" digits:(HEX HEX HEX HEX HEX HEX HEX HEX) { return convertCodePoint(digits.join('')) }
                 / "\\u" digits:(HEX HEX HEX HEX) { return convertCodePoint(digits.join('')) }

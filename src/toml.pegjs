{
  var nodes = [];
  var inputText = input;

  function resolveLineCol(off) {
    var line = 1, col = 1;
    for (var i = 0; i < off; i++) {
      if (inputText.charCodeAt(i) === 10) { line++; col = 1; }
      else { col++; }
    }
    return { line: line, column: col };
  }

  function genError(err, off) {
    var pos = resolveLineCol(off);
    var ex = new Error(err);
    ex.line = pos.line;
    ex.column = pos.column;
    throw ex;
  }

  function addNode(node) {
    nodes.push(node);
  }

  function node(type, value, off, key) {
    var obj = { type: type, value: value, offset: off };
    if (key) obj.key = key;
    return obj;
  }

  function validateDate(dateStr, off) {
    var year = dateStr.charCodeAt(0) * 1000 + dateStr.charCodeAt(1) * 100 + dateStr.charCodeAt(2) * 10 + dateStr.charCodeAt(3) - 53328;
    var month = (dateStr.charCodeAt(5) - 48) * 10 + dateStr.charCodeAt(6) - 48;
    var day = (dateStr.charCodeAt(8) - 48) * 10 + dateStr.charCodeAt(9) - 48;
    if (month < 1 || month > 12) {
      genError("Invalid date: month " + month + " out of range.", off);
    }
    var maxDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
      maxDays[1] = 29;
    }
    if (day < 1 || day > maxDays[month - 1]) {
      genError("Invalid date: day " + day + " out of range for month " + month + ".", off);
    }
  }

  function validateTime(timeStr, off) {
    var hour = (timeStr.charCodeAt(0) - 48) * 10 + timeStr.charCodeAt(1) - 48;
    var minute = (timeStr.charCodeAt(3) - 48) * 10 + timeStr.charCodeAt(4) - 48;
    var second = (timeStr.charCodeAt(6) - 48) * 10 + timeStr.charCodeAt(7) - 48;
    if (hour > 23) {
      genError("Invalid time: hour " + hour + " out of range.", off);
    }
    if (minute > 59) {
      genError("Invalid time: minute " + minute + " out of range.", off);
    }
    if (second > 59) {
      genError("Invalid time: second " + second + " out of range.", off);
    }
  }

  function validateOffset(offsetStr, off) {
    if (offsetStr === "Z" || offsetStr === "z") return;
    var hour = (offsetStr.charCodeAt(1) - 48) * 10 + offsetStr.charCodeAt(2) - 48;
    var minute = (offsetStr.charCodeAt(4) - 48) * 10 + offsetStr.charCodeAt(5) - 48;
    if (hour > 23) {
      genError("Invalid offset: hour " + hour + " out of range.", off);
    }
    if (minute > 59) {
      genError("Invalid offset: minute " + minute + " out of range.", off);
    }
  }

  function stripUnderscores(str) {
    return str.indexOf('_') === -1 ? str : str.replace(/_/g, '');
  }

  function convertCodePoint(str) {
    var num = parseInt(str, 16);

    if (
      num !== num ||
      num < 0 ||
      num > 0x10FFFF ||
      (num > 0xD7FF && num < 0xE000)
    ) {
      genError("Invalid Unicode escape code: " + str, offset());
    } else {
      return String.fromCodePoint(num);
    }
  }
}

start
  = line*                               { return nodes }

line
  = S* expr:expression S* comment? (NL+ / EOF)
  / S+ (NL+ / EOF)
  / NL

expression
  = comment / table_or_array_path / assignment

comment
  = '#' [\x09\x20-\x7E\x80-\uFFFF]*

// Unified '[' entry: try '[[' first for array-of-tables, fall back to '[' for table
table_or_array_path
  = '[' '[' S* name:table_key S* ']' ']'      { addNode(node('ArrayPath', name, offset())) }
  / '[' S* name:table_key S* ']'              { addNode(node('ObjectPath', name, offset())) }

table_key
  = parts:dot_ended_table_key_part+ name:table_key_part    { return parts.concat(name) }
  / name:table_key_part                                    { return [name] }

table_key_part
  = S* name:simple_key S*               { return name }

dot_ended_table_key_part
  = S* name:simple_key S* '.'           { return name }

assignment
  = keys:inline_key S* '=' S* value:value { addNode(node('Assign', value, offset(), keys)) }

key
  = $ASCII_BASIC+

quoted_key
  = node:double_quoted_single_line_string { return node.value }
  / node:single_quoted_single_line_string { return node.value }

value
  = string / number_or_date / boolean / array / inline_table

// Unified entry point for numbers and dates — avoids backtracking across
// datetime, float, and integer when they all start with digits.
number_or_date
  = sign:[+-]? 'inf'                                  { return node('Float', sign === '-' ? -Infinity : Infinity, offset()) }
  / sign:[+-]? 'nan'                                  { return node('Float', NaN, offset()) }
  / datetime
  / float
  / integer

string
  = double_quoted_multiline_string
  / double_quoted_single_line_string
  / single_quoted_multiline_string
  / single_quoted_single_line_string

double_quoted_multiline_string
  = '"""' NL? body:mlb_body '"""'       { return node('String', body, offset()) }

double_quoted_single_line_string
  = '"' chars:string_char* '"'          { return node('String', chars.join(''), offset()) }

single_quoted_multiline_string
  = "'''" NL? body:mll_body "'''"       { return node('String', body, offset()) }

single_quoted_single_line_string
  = "'" chars:literal_char* "'"         { return node('String', chars.join(''), offset()) }

// Multiline basic string body — follows the ABNF:
// *mlb-content *( mlb-quotes 1*mlb-content ) [ mlb-quotes ]
mlb_body
  = head:mlb_content* parts:(mlb_quotes mlb_content+)* tail:mlb_trailing? {
      var result = head.join('');
      for (var i = 0; i < parts.length; i++) { result += parts[i][0] + parts[i][1].join(''); }
      return result + (tail || '');
    }

mlb_content
  = ESCAPED
  / mlb_escaped_newline
  / '\\' . { genError("Invalid escape sequence", offset()) }
  / "\r\n" { return "\n" }
  / $[^"\\\x00-\x08\x0B-\x1F\x7F\r]+

mlb_escaped_newline
  = '\\' S* NL NLS*                     { return '' }

mlb_quotes
  = '""' !'"'                            { return '""' }
  / '"' !'"'                             { return '"' }

mlb_trailing
  = '""' &'"""'                          { return '""' }
  / '"' &'"""'                           { return '"' }

// Multiline literal string body
mll_body
  = head:mll_content* parts:(mll_quotes mll_content+)* tail:mll_trailing? {
      var result = head.join('');
      for (var i = 0; i < parts.length; i++) { result += parts[i][0] + parts[i][1].join(''); }
      return result + (tail || '');
    }

mll_content
  = "\r\n" { return "\n" }
  / $[^'\x00-\x08\x0B-\x1F\x7F\r]+

mll_quotes
  = "''" !"'"                            { return "''" }
  / "'" !"'"                             { return "'" }

mll_trailing
  = "''" &"'''"                          { return "''" }
  / "'" &"'''"                           { return "'" }

string_char
  = ESCAPED
  / '\\' . { genError("Invalid escape sequence", offset()) }
  / $[^\"\\\x00-\x08\x0A-\x1F\x7F]+

literal_char
  = $[^'\x00-\x08\x0A-\x1F\x7F]+

float
  = left:float_or_int_text [eE] right:float_exp_text  { return node('Float', parseFloat(stripUnderscores(left + 'e' + right)), offset()) }
  / text:float_text                                   { return node('Float', parseFloat(stripUnderscores(text)), offset()) }

float_text
  = sign:[+-]? digits:FLOAT_DEC_INT '.' frac:$DEC_DIGIT_SEQ  { return (sign === '-' ? '-' : '') + digits + '.' + frac }

float_or_int_text
  = sign:[+-]? digits:FLOAT_DEC_INT '.' frac:$DEC_DIGIT_SEQ  { return (sign === '-' ? '-' : '') + digits + '.' + frac }
  / sign:[+-]? digits:FLOAT_DEC_INT                    { return (sign === '-' ? '-' : '') + digits }

// Integer part of floats follows same no-leading-zero rule as integers
FLOAT_DEC_INT
  = '0' { return '0' }
  / $DEC_INT_NOZERO_SEQ

float_exp_text
  = sign:[+-]? digits:$DEC_DIGIT_SEQ                          { return (sign || '') + digits }

integer
  = '0x' digits:$HEX_DIGIT_SEQ                               { return node('Integer', parseInt(stripUnderscores(digits), 16), offset()) }
  / '0o' digits:$OCT_DIGIT_SEQ                                { return node('Integer', parseInt(stripUnderscores(digits), 8), offset()) }
  / '0b' digits:$BIN_DIGIT_SEQ                                { return node('Integer', parseInt(stripUnderscores(digits), 2), offset()) }
  / text:dec_integer_text                              { return node('Integer', parseInt(stripUnderscores(text), 10), offset()) }

dec_integer_text
  = sign:[+-]? '0' !([0-9_]) !'.'                     { return (sign || '') + '0' }
  / sign:[+-]? digits:$DEC_INT_NOZERO_SEQ !'.'             { return (sign || '') + digits }

DEC_INT_NOZERO_SEQ
  = [1-9] ([_]? [0-9])*

// Digit sequences - captured as text with $()
DEC_DIGIT_SEQ
  = [0-9] ([_]? [0-9])*

HEX_DIGIT_SEQ
  = [0-9a-fA-F] ([_]? [0-9a-fA-F])*

OCT_DIGIT_SEQ
  = [0-7] ([_]? [0-7])*

BIN_DIGIT_SEQ
  = [01] ([_]? [01])*

boolean
  = 'true'                              { return node('Boolean', true, offset()) }
  / 'false'                             { return node('Boolean', false, offset()) }

array
  = '[' array_sep* ']'                                 { return node('Array', [], offset()) }
  / '[' array_sep* head:value tail:(array_sep* ',' array_sep* v:value { return v })* array_sep* ','? array_sep* ']' {
      tail.unshift(head); return node('Array', tail, offset())
    }

array_sep
  = S / NL / comment

inline_table
  = '{' inline_sep* '}' { return node('InlineTable', [], offset()) }
  / '{' inline_sep* head:inline_table_entry tail:(inline_sep* ',' inline_sep* e:inline_table_entry { return e })* inline_sep* ','? inline_sep* '}' {
      tail.unshift(head); return node('InlineTable', tail, offset())
    }

inline_table_entry
  = keys:inline_key S* '=' S* value:value                                                        { return node('InlineTableValue', value, offset(), keys) }

inline_sep
  = S / NL / comment

inline_key
  = parts:inline_dot_key_part+ S* last:simple_key                        { return parts.concat(last) }
  / k:simple_key                                                         { return [k] }

inline_dot_key_part
  = S* k:simple_key S* '.'                                               { return k }

simple_key
  = key
  / quoted_key

secfragment
  = $('.' DIGIT+)

date_part
  = $(DIGIT DIGIT DIGIT DIGIT '-' DIGIT DIGIT '-' DIGIT DIGIT)

time_part
  = t:$(DIGIT DIGIT ':' DIGIT DIGIT ':' DIGIT DIGIT) frac:secfragment? { return frac ? t + frac : t }
  / t:$(DIGIT DIGIT ':' DIGIT DIGIT) !(':') { return t + ':00' }

offset
  = 'Z'i                                              { return "Z" }
  / $(sign:[+-] DIGIT DIGIT ':' DIGIT DIGIT)

datetime
  = d:date_part datetime_delim t:time_part o:offset    { var off = offset(); validateDate(d, off); validateTime(t, off); validateOffset(o, off); return node('Date', new Date(d + "T" + t + o), off) }
  / d:date_part datetime_delim t:time_part             { var off = offset(); validateDate(d, off); validateTime(t, off); return node('LocalDateTime', d + "T" + t, off) }
  / d:date_part !datetime_delim                         { var off = offset(); validateDate(d, off); return node('LocalDate', d, off) }
  / t:time_part                                        { var off = offset(); validateTime(t, off); return node('LocalTime', t, off) }

datetime_delim
  = 'T'i / ' ' &DIGIT

S                = [ \t]
NL               = "\n" / "\r" "\n"
NLS              = NL / S
EOF              = !.
DIGIT            = [0-9]
HEX              = [0-9a-fA-F]
ASCII_BASIC      = [A-Za-z0-9_\-]
ESCAPED          = '\\' ch:[\"\\btnfre] { return ch === 'n' ? '\n' : ch === 't' ? '\t' : ch === 'r' ? '\r' : ch === '\\' ? '\\' : ch === '"' ? '"' : ch === 'b' ? '\b' : ch === 'f' ? '\f' : '\x1B' }
                 / ESCAPED_UNICODE
ESCAPED_UNICODE  = "\\U" digits:$(HEX HEX HEX HEX HEX HEX HEX HEX) { return convertCodePoint(digits) }
                 / "\\u" digits:$(HEX HEX HEX HEX) { return convertCodePoint(digits) }
                 / "\\x" digits:$(HEX HEX) { return convertCodePoint(digits) }

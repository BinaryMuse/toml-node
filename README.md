TOML Parser for Node.js
=======================

[![CI](https://github.com/BinaryMuse/toml-node/actions/workflows/ci.yml/badge.svg)](https://github.com/BinaryMuse/toml-node/actions/workflows/ci.yml)

If you haven't heard of TOML, well you're just missing out. [Go check it out now.](https://toml.io) Back? Good.

TOML Spec Support
-----------------

toml-node supports [TOML v1.1.0](https://toml.io/en/v1.1.0), scoring **673/680 (99.0%)** on the official [toml-test](https://github.com/toml-lang/toml-test) compliance suite:

| | Pass | Total | Rate |
|---|---|---|---|
| Valid tests | 213 | 214 | 99.5% |
| Invalid tests | 460 | 466 | 98.7% |
| **Total** | **673** | **680** | **99.0%** |

The 7 remaining failures are inherent JavaScript platform limitations shared by all JS TOML parsers:

- 1 valid test: 64-bit integer precision (`Number` can't represent values beyond `Number.MAX_SAFE_INTEGER`)
- 6 invalid tests: UTF-8 encoding validation (Node.js handles UTF-8 decoding at the engine level before the parser sees the data)

### Feature Support

- **Strings**: basic, literal, multiline, all escape sequences (`\uXXXX`, `\UXXXXXXXX`, `\xHH`, `\e`)
- **Integers**: decimal, hexadecimal (`0xDEADBEEF`), octal (`0o755`), binary (`0b11010110`)
- **Floats**: decimal, scientific notation, `inf`, `-inf`, `nan`
- **Booleans**: `true`, `false`
- **Dates/Times**: offset date-time, local date-time, local date, local time; seconds optional
- **Arrays**: mixed types allowed
- **Tables**: standard, inline (with dotted/quoted keys, newlines, trailing commas), array of tables
- **Keys**: bare, quoted, dotted (`fruit.apple.color = "red"`)
- **Comments**: `# line comments`

Installation
------------

```
npm install toml
```

Requires Node.js 20 or later. Zero runtime dependencies.

Usage
-----

```javascript
const toml = require('toml');
const data = toml.parse(someTomlString);
```

`toml.parse` throws an exception on parse errors with `line` and `column` properties:

```javascript
try {
  toml.parse(someBadToml);
} catch (e) {
  console.error(`Parsing error on line ${e.line}, column ${e.column}: ${e.message}`);
}
```

### Date/Time Values

Offset date-times are returned as JavaScript `Date` objects. Local date-times, local dates, and local times are returned as strings since they have no timezone information and can't be losslessly represented as `Date`:

```javascript
const data = toml.parse(`
odt = 1979-05-27T07:32:00Z       # Date object
ldt = 1979-05-27T07:32:00        # string: "1979-05-27T07:32:00"
ld  = 1979-05-27                  # string: "1979-05-27"
lt  = 07:32:00                    # string: "07:32:00"
`);

data.odt instanceof Date  // true
typeof data.ldt            // "string"
typeof data.ld             // "string"
typeof data.lt             // "string"
```

### Special Float Values

`inf` and `nan` are returned as JavaScript `Infinity` and `NaN`:

```javascript
const data = toml.parse(`
pos_inf = inf
neg_inf = -inf
not_a_number = nan
`);

data.pos_inf === Infinity   // true
data.neg_inf === -Infinity  // true
Number.isNaN(data.not_a_number) // true
```

### Requiring .toml Files

You can use the [toml-require package](https://github.com/BinaryMuse/toml-require) to `require()` your `.toml` files with Node.js.

Building & Testing
------------------

toml-node uses the [Peggy parser generator](https://peggyjs.org/) (successor to PEG.js).

```
npm install
npm run build
npm test
npm run test:spec           # run toml-test compliance suite
npm run test:spec:failures  # show failure details
```

Changes to `src/toml.pegjs` require a rebuild with `npm run build`.

License
-------

toml-node is licensed under the MIT license agreement. See the LICENSE file for more information.

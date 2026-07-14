TOML Parser for Node.js
=======================

[![CI](https://github.com/BinaryMuse/toml-node/actions/workflows/ci.yml/badge.svg)](https://github.com/BinaryMuse/toml-node/actions/workflows/ci.yml)

If you haven't heard of TOML, well you're just missing out. [Go check it out now.](https://toml.io) Back? Good.

TOML Spec Support
-----------------

toml-node supports [TOML v1.1.0](https://toml.io/en/v1.1.0), scoring **702/708 (99.2%)** on the official [toml-test](https://github.com/toml-lang/toml-test) compliance suite:

| | Pass | Total | Rate |
|---|---|---|---|
| Valid tests | 218 | 218 | 100% |
| Invalid tests | 484 | 490 | 98.8% |
| **Total** | **702** | **708** | **99.2%** |

The 6 remaining failures are inherent JavaScript platform limitations shared by all JS TOML parsers: they cover UTF-8 encoding validation, which Node.js handles at the engine level before the parser sees the data.

Note that integers beyond `Number.MAX_SAFE_INTEGER` require the [`bigint` option](#integer-range-and-bigint) to parse losslessly; without it they throw a parse error rather than silently losing precision.

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

### Nesting Depth Limit

To guard against stack overflow on maliciously deep input, arrays and inline tables may nest at most 500 levels deep by default; input past the limit throws a normal parse error. Adjust the limit with the `maxDepth` option:

```javascript
toml.parse(someTomlString, { maxDepth: 100 });
```

### Integer Range and BigInt

TOML requires parsers to handle the full range of 64-bit signed integers, but JavaScript's `number` type can only represent integers up to `Number.MAX_SAFE_INTEGER` (2⁵³ − 1) losslessly. By default, `toml.parse` returns integers as `number` and throws a parse error when a value falls outside the safe range, rather than silently returning a rounded value:

```javascript
toml.parse('id = 771752188537605140');
// Error: Integer 771752188537605140 cannot be represented losslessly
// as a JavaScript number. Use the `bigint` option to parse integers
// as BigInt values.
```

Pass `bigint: true` to instead parse **all** integers as `BigInt`, preserving the full 64-bit range:

```javascript
const data = toml.parse('id = 771752188537605140\ncount = 3', { bigint: true });
data.id     // 771752188537605140n
data.count  // 3n
```

Integers outside the 64-bit signed range always throw, in either mode, as required by the spec. Floats are unaffected by all of this: TOML floats are IEEE 754 binary64 values, which is exactly what a JavaScript `number` is, so every TOML float is represented as faithfully as the spec intends.

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

#### Temporal Support

Pass `useTemporal: true` to have date/time values returned as
[Temporal](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
objects instead:

| TOML type        | Returned as               |
| ---------------- | ------------------------- |
| Offset date-time | `Temporal.ZonedDateTime`  |
| Local date-time  | `Temporal.PlainDateTime`  |
| Local date       | `Temporal.PlainDate`      |
| Local time       | `Temporal.PlainTime`      |

```javascript
const data = toml.parse(`
odt = 1979-05-27T00:32:00-07:00
ldt = 1979-05-27T07:32:00
ld  = 1979-05-27
lt  = 07:32:00
`, { useTemporal: true });

data.odt.toString()  // "1979-05-27T00:32:00-07:00[-07:00]"
data.ldt.toString()  // "1979-05-27T07:32:00"
data.ld.toString()   // "1979-05-27"
data.lt.toString()   // "07:32:00"
```

Offset date-times become `Temporal.ZonedDateTime` values whose time zone is
the original UTC offset (`Z` maps to the `UTC` time zone), so the offset
written in the TOML document is preserved — unlike the default `Date`
representation, which loses it. Fractional seconds beyond nanosecond
precision are truncated, as permitted by the TOML spec.

`useTemporal` requires a runtime with the `Temporal` global. On runtimes
that don't provide it yet, pass an implementation such as
[`@js-temporal/polyfill`](https://www.npmjs.com/package/@js-temporal/polyfill)
via the `temporal` option:

```javascript
const { Temporal } = require('@js-temporal/polyfill');
const data = toml.parse(someTomlString, { useTemporal: true, temporal: Temporal });
```

Once `Temporal` is broadly available, Temporal output is expected to become
the default behavior in a future major version.

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

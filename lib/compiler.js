"use strict";

var INT64_MIN = -(2n ** 63n);
var INT64_MAX = 2n ** 63n - 1n;
var MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
var MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

// TOML's redefinition rules depend on how a table came to exist, not on its
// shape, so every container the compiler creates is tagged with its origin.
// Values that arrive from the parser (dates, static arrays, primitives) are
// never tagged, which is what stops key paths from descending into them and
// on into their prototype chains.
var HEADER_TABLE = "header";     // [a]
var IMPLICIT_TABLE = "implicit"; // `a` in [a.b]; a later [a] header may still define it
var DOTTED_TABLE = "dotted";     // `a` in a.b = 1
var INLINE_TABLE = "inline";     // a = { b = 1 }; closed once parsed
var TABLE_ARRAY = "table-array"; // [[a]]

function compile(nodes, inputText, options) {
  options = options || {};
  var temporal = null;
  if (options.useTemporal) {
    temporal = options.temporal || (typeof Temporal !== "undefined" ? Temporal : null);
    if (!temporal) {
      throw new Error(
        "The `useTemporal` option was set, but no Temporal implementation is available. " +
        "Use a runtime with global `Temporal` support, or provide an implementation " +
        "(e.g. from the `@js-temporal/polyfill` package) via the `temporal` option."
      );
    }
  }

  var containerKinds = new WeakMap();
  var data = createTable(HEADER_TABLE);
  var context = data;
  var currentPath = [];

  return reduce(nodes);

  function reduce(nodes) {
    var node;
    for (var i = 0; i < nodes.length; i++) {
      node = nodes[i];
      switch (node.type) {
      case "Assign":
        assign(node);
        break;
      case "ObjectPath":
        setPath(node);
        break;
      case "ArrayPath":
        addTableArray(node);
        break;
      }
    }

    return data;
  }

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

  function assign(node) {
    var keys = Array.isArray(node.key) ? node.key : [node.key];
    assignDotted(context, keys, reduceValueNode(node.value), node.offset, currentPath);
  }

  // Walks `keys` down from `table`, creating intermediate tables as needed,
  // and stores `value` under the last key. `prefix` names the path leading to
  // `table` and is only used in error messages.
  function assignDotted(table, keys, value, off, prefix) {
    for (var i = 0; i < keys.length - 1; i++) {
      var key = keys[i];
      var next = table[key];
      if (next === undefined) {
        next = createTable(DOTTED_TABLE);
        table[key] = next;
      } else {
        var kind = containerKinds.get(next);
        if (kind !== DOTTED_TABLE && kind !== IMPLICIT_TABLE) {
          var path = pathKey(prefix.concat(keys.slice(0, i + 1)));
          if (kind === HEADER_TABLE) {
            genError("Cannot use dotted keys to extend table '" + path + "' defined elsewhere.", off);
          }
          if (kind === INLINE_TABLE) {
            genError("Cannot extend inline table '" + path + "'.", off);
          }
          genError("Cannot redefine existing key '" + path + "'.", off);
        }
      }
      table = next;
    }

    var lastKey = keys[keys.length - 1];
    if (table[lastKey] !== undefined) {
      genError("Cannot redefine existing key '" + pathKey(prefix.concat(keys)) + "'.", off);
    }
    table[lastKey] = value;
  }

  function reduceValueNode(node) {
    if (node.type === "Integer") {
      return reduceInteger(node);
    } else if (node.type === "Array") {
      return reduceArray(node.value);
    } else if (node.type === "InlineTable") {
      return reduceInlineTableNode(node.value);
    } else if (temporal) {
      switch (node.type) {
      case "Date":
        return temporal.ZonedDateTime.from(
          truncateFractionalSeconds(node.raw) + node.tz +
          "[" + (node.tz === "Z" ? "UTC" : node.tz) + "]"
        );
      case "LocalDateTime":
        return temporal.PlainDateTime.from(truncateFractionalSeconds(node.value));
      case "LocalDate":
        return temporal.PlainDate.from(node.value);
      case "LocalTime":
        return temporal.PlainTime.from(truncateFractionalSeconds(node.value));
      }
    }
    return node.value;
  }

  // TOML allows arbitrary fractional-second precision (implementations may
  // truncate); Temporal rejects more than 9 digits (nanoseconds).
  function truncateFractionalSeconds(str) {
    return str.replace(/\.(\d{9})\d+/, ".$1");
  }

  // Integer nodes arrive from the parser as BigInt so the full 64-bit
  // range is preserved exactly.
  function reduceInteger(node) {
    var value = node.value;
    if (value < INT64_MIN || value > INT64_MAX) {
      genError(
        "Integer " + value + " is outside the 64-bit signed integer range required by TOML.",
        node.offset
      );
    }
    if (options.bigint) {
      return value;
    }
    if (value < MIN_SAFE || value > MAX_SAFE) {
      genError(
        "Integer " + value + " cannot be represented losslessly as a JavaScript number. " +
        "Use the `bigint` option to parse integers as BigInt values.",
        node.offset
      );
    }
    return Number(value);
  }

  function reduceInlineTableNode(values) {
    var table = createTable(INLINE_TABLE);

    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      if (val.type !== "InlineTableValue") continue;

      var keys = Array.isArray(val.key) ? val.key : [val.key];
      assignDotted(table, keys, reduceValueNode(val.value), val.offset, []);
    }

    return table;
  }

  function setPath(node) {
    var path = node.value;
    var off = node.offset;

    var parent = resolveParentTable(path, off);
    var name = path[path.length - 1];
    var table = parent[name];

    if (table === undefined) {
      table = createTable(HEADER_TABLE);
      parent[name] = table;
    } else if (containerKinds.get(table) === IMPLICIT_TABLE) {
      containerKinds.set(table, HEADER_TABLE);
    } else {
      genError("Cannot redefine existing key '" + pathKey(path) + "'.", off);
    }

    context = table;
    currentPath = path;
  }

  function addTableArray(node) {
    var path = node.value;
    var off = node.offset;

    var parent = resolveParentTable(path, off);
    var name = path[path.length - 1];
    var tableArray = parent[name];

    if (tableArray === undefined) {
      tableArray = createTableArray();
      parent[name] = tableArray;
    } else if (containerKinds.get(tableArray) !== TABLE_ARRAY) {
      if (Array.isArray(tableArray)) {
        genError("Cannot append to statically defined array '" + pathKey(path) + "'.", off);
      }
      genError("Cannot redefine existing key '" + pathKey(path) + "'.", off);
    }

    var table = createTable(HEADER_TABLE);
    tableArray.push(table);
    context = table;
    currentPath = path;
  }

  // Returns the table a header's last key belongs in, creating implicit
  // tables along the way. A path through an array of tables refers to its
  // most recent element.
  function resolveParentTable(path, off) {
    var table = data;
    for (var i = 0; i < path.length - 1; i++) {
      var key = path[i];
      var next = table[key];
      if (next === undefined) {
        next = createTable(IMPLICIT_TABLE);
        table[key] = next;
      }

      var kind = containerKinds.get(next);
      if (kind === TABLE_ARRAY) {
        next = next[next.length - 1];
      } else if (kind === undefined || kind === INLINE_TABLE) {
        genError("Cannot redefine existing key '" + pathKey(path.slice(0, i + 1)) + "'.", off);
      }
      table = next;
    }
    return table;
  }

  function reduceArray(array) {
    return array.map(reduceValueNode);
  }

  function createTable(kind) {
    var table = Object.create(null);
    containerKinds.set(table, kind);
    return table;
  }

  function createTableArray() {
    var tableArray = [];
    containerKinds.set(tableArray, TABLE_ARRAY);
    return tableArray;
  }

  function pathKey(keys) {
    return keys.map(quoteDottedString).join(".");
  }

  function quoteDottedString(str) {
    if (str.indexOf(".") > -1) {
      return "\"" + str + "\"";
    } else {
      return str;
    }
  }
}

module.exports = {
  compile: compile
};

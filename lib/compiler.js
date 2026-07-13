"use strict";
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

  var assignedPaths = new Set();
  var valueAssignments = new Set();
  var explicitTablePaths = new Set();
  var currentPath = [];
  var ownedContainers = new WeakSet();
  var data = createTable();
  var context = data;

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
    var keys = node.key;
    var value = node.value;
    var off = node.offset;

    if (!Array.isArray(keys)) keys = [keys];

    var reduced = reduceValueNode(value);

    var target = context;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      var intermediatePath = makeFullPath(keys.slice(0, i + 1));

      if (typeof target[k] === "undefined") {
        target[k] = createTable();
        assignedPaths.add(intermediatePath);
      } else if (typeof target[k] !== "object" || target[k] === null || Array.isArray(target[k])) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", off);
      } else if (valueAssignments.has(intermediatePath)) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", off);
      } else if (explicitTablePaths.has(intermediatePath) && intermediatePath !== pathKey(currentPath)) {
        genError("Cannot use dotted keys to extend table '" + intermediatePath + "' defined elsewhere.", off);
      }
      target = target[k];
    }

    var lastKey = keys[keys.length - 1];
    var fullPath = makeFullPath(keys);

    if (typeof target[lastKey] !== "undefined") {
      genError("Cannot redefine existing key '" + fullPath + "'.", off);
    }

    target[lastKey] = reduced;

    assignedPaths.add(fullPath);
    valueAssignments.add(fullPath);
  }


  function reduceValueNode(node) {
    if (node.type === "Array") {
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

  function reduceInlineTableNode(values) {
    var obj = createTable();
    var definedKeys = new Set();

    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      if (val.type !== "InlineTableValue") continue;

      var keys = val.key;
      if (!Array.isArray(keys)) keys = [keys];

      var reduced = reduceValueNode(val.value);
      setNestedKey(obj, keys, reduced, val.offset, definedKeys);

      definedKeys.add(pathKey(keys));
    }

    return obj;
  }

  function setNestedKey(obj, keys, value, off, definedKeys) {
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      var intermediatePath = pathKey(keys.slice(0, i + 1));
      if (typeof obj[k] === "undefined") {
        obj[k] = createTable();
      } else if (typeof obj[k] !== "object" || obj[k] === null || Array.isArray(obj[k])) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", off);
      } else if (definedKeys && definedKeys.has(intermediatePath)) {
        genError("Cannot extend inline table '" + intermediatePath + "'.", off);
      }
      obj = obj[k];
    }
    var lastKey = keys[keys.length - 1];
    if (typeof obj[lastKey] !== "undefined") {
      genError("Cannot redefine existing key '" + pathKey(keys) + "'.", off);
    }
    obj[lastKey] = value;
  }

  function setPath(node) {
    var path = node.value;
    var quotedPath = path.map(quoteDottedString).join(".");
    var off = node.offset;

    if (assignedPaths.has(quotedPath)) {
      genError("Cannot redefine existing key '" + path + "'.", off);
    }
    assignedPaths.add(quotedPath);
    explicitTablePaths.add(quotedPath);
    context = deepRef(data, path, createTable(), off);
    currentPath = path;
  }

  function addTableArray(node) {
    var path = node.value;
    var quotedPath = path.map(quoteDottedString).join(".");
    var off = node.offset;

    if (valueAssignments.has(quotedPath)) {
      genError("Cannot append to statically defined array '" + quotedPath + "'.", off);
    }

    // Clear this table array path and paths nested under it.
    assignedPaths.forEach(function(p) {
      if (isSameOrSubPath(p, quotedPath)) assignedPaths.delete(p);
    });
    valueAssignments.forEach(function(p) {
      if (isSameOrSubPath(p, quotedPath)) valueAssignments.delete(p);
    });
    assignedPaths.add(quotedPath);
    context = deepRef(data, path, createTableArray(), off);
    currentPath = path;

    if (context instanceof Array) {
      var newObj = createTable();
      context.push(newObj);
      context = newObj;
    } else {
      genError("Cannot redefine existing key '" + path + "'.", off);
    }
  }

  function deepRef(start, keys, value, off) {
    var ctx = start;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var traversedPath = pathKey(keys.slice(0, i + 1));
      if (typeof ctx[key] === "undefined") {
        if (i === keys.length - 1) {
          ctx[key] = value;
        } else {
          ctx[key] = createTable();
        }
      } else if (i !== keys.length - 1 && valueAssignments.has(traversedPath)) {
        genError("Cannot redefine existing key '" + traversedPath + "'.", off);
      }

      ctx = ctx[key];
      if (i < keys.length - 1) {
        if (!isOwnedContainer(ctx)) {
          genError("Cannot redefine existing key '" + traversedPath + "'.", off);
        }
        if (ctx instanceof Array) {
          if (!ctx.length) {
            genError("Cannot redefine existing key '" + traversedPath + "'.", off);
          }
          ctx = ctx[ctx.length - 1];
          if (!isOwnedContainer(ctx)) {
            genError("Cannot redefine existing key '" + traversedPath + "'.", off);
          }
        }
      }
    }

    return ctx;
  }

  function reduceArray(array) {
    return array.map(reduceValueNode);
  }

  function quoteDottedString(str) {
    if (str.indexOf(".") > -1) {
      return "\"" + str + "\"";
    } else {
      return str;
    }
  }

  function createTable() {
    var table = Object.create(null);
    ownedContainers.add(table);
    return table;
  }

  function createTableArray() {
    var tableArray = [];
    ownedContainers.add(tableArray);
    return tableArray;
  }

  function isOwnedContainer(value) {
    return value !== null && typeof value === "object" && ownedContainers.has(value);
  }

  function pathKey(keys) {
    return keys.map(quoteDottedString).join(".");
  }

  function makeFullPath(keys) {
    return pathKey(currentPath.concat(keys));
  }

  function isSameOrSubPath(path, prefix) {
    return path === prefix || path.indexOf(prefix + ".") === 0;
  }
}

module.exports = {
  compile: compile
};

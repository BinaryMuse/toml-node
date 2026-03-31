"use strict";
function compile(nodes) {
  var assignedPaths = [];
  var valueAssignments = [];
  var explicitTablePaths = [];
  var tableArrayPaths = [];
  var currentPath = "";
  var data = Object.create(null);
  var context = data;
  var arrayMode = false;

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

  function genError(err, line, col) {
    var ex = new Error(err);
    ex.line = line;
    ex.column = col;
    throw ex;
  }

  function assign(node) {
    var keys = node.key;
    var value = node.value;
    var line = node.line;
    var column = node.column;

    // Support both legacy single-string keys and new array-of-keys format
    if (!Array.isArray(keys)) keys = [keys];

    var reduced = reduceValueNode(value);

    // Navigate to the right context for dotted keys, creating intermediate tables
    var target = context;
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      var intermediatePath = currentPath ? currentPath + "." + keys.slice(0, i + 1).join(".") : keys.slice(0, i + 1).join(".");

      if (typeof target[k] === "undefined") {
        target[k] = Object.create(null);
        if (!pathAssigned(intermediatePath)) {
          assignedPaths.push(intermediatePath);
        }
      } else if (typeof target[k] !== "object" || target[k] === null || Array.isArray(target[k])) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", line, column);
      } else if (valueAssignments.indexOf(intermediatePath) > -1) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", line, column);
      } else if (explicitTablePaths.indexOf(intermediatePath) > -1 && intermediatePath !== (Array.isArray(currentPath) ? currentPath.join(".") : currentPath)) {
        genError("Cannot use dotted keys to extend table '" + intermediatePath + "' defined elsewhere.", line, column);
      }
      target = target[k];
    }

    var lastKey = keys[keys.length - 1];
    var fullPath = currentPath ? currentPath + "." + keys.join(".") : keys.join(".");

    if (typeof target[lastKey] !== "undefined") {
      genError("Cannot redefine existing key '" + fullPath + "'.", line, column);
    }

    target[lastKey] = reduced;

    if (!pathAssigned(fullPath)) {
      assignedPaths.push(fullPath);
      valueAssignments.push(fullPath);
    }
  }


  function pathAssigned(path) {
    return assignedPaths.indexOf(path) !== -1;
  }

  function reduceValueNode(node) {
    if (node.type === "Array") {
      return reduceArray(node.value);
    } else if (node.type === "InlineTable") {
      return reduceInlineTableNode(node.value);
    } else {
      return node.value;
    }
  }

  function reduceInlineTableNode(values) {
    var obj = Object.create(null);
    // Track paths that were explicitly defined (either as values or as inline
    // table results). Dotted keys can create implicit intermediate tables but
    // cannot modify explicitly defined ones.
    var definedKeys = [];

    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      if (val.type !== "InlineTableValue") continue;

      var keys = val.key;
      if (!Array.isArray(keys)) keys = [keys];

      var reduced = reduceValueNode(val.value);
      setNestedKey(obj, keys, reduced, val.line, val.column, definedKeys);

      // Track the full path as a defined key
      definedKeys.push(keys.join("."));
    }

    return obj;
  }

  function setNestedKey(obj, keys, value, line, column, definedKeys) {
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      var intermediatePath = keys.slice(0, i + 1).join(".");
      if (typeof obj[k] === "undefined") {
        obj[k] = Object.create(null);
      } else if (typeof obj[k] !== "object" || obj[k] === null || Array.isArray(obj[k])) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", line, column);
      } else if (definedKeys && definedKeys.indexOf(intermediatePath) > -1) {
        // Cannot extend an explicitly-defined inline table
        genError("Cannot extend inline table '" + intermediatePath + "'.", line, column);
      }
      obj = obj[k];
    }
    var lastKey = keys[keys.length - 1];
    if (typeof obj[lastKey] !== "undefined") {
      genError("Cannot redefine existing key '" + keys.join(".") + "'.", line, column);
    }
    obj[lastKey] = value;
  }

  function setPath(node) {
    var path = node.value;
    var quotedPath = path.map(quoteDottedString).join(".");
    var line = node.line;
    var column = node.column;

    if (pathAssigned(quotedPath)) {
      genError("Cannot redefine existing key '" + path + "'.", line, column);
    }
    assignedPaths.push(quotedPath);
    explicitTablePaths.push(quotedPath);
    context = deepRef(data, path, Object.create(null), line, column);
    currentPath = path;
  }

  function addTableArray(node) {
    var path = node.value;
    var quotedPath = path.map(quoteDottedString).join(".");
    var line = node.line;
    var column = node.column;

    // Check before filtering: cannot append to a statically-defined array
    if (valueAssignments.indexOf(quotedPath) > -1) {
      genError("Cannot append to statically defined array '" + quotedPath + "'.", line, column);
    }

    if (!pathAssigned(quotedPath)) {
      assignedPaths.push(quotedPath);
    }
    assignedPaths = assignedPaths.filter(function(p) {
      return p.indexOf(quotedPath) !== 0;
    });
    valueAssignments = valueAssignments.filter(function(p) {
      return p.indexOf(quotedPath) !== 0;
    });
    assignedPaths.push(quotedPath);
    context = deepRef(data, path, [], line, column);
    currentPath = quotedPath;

    if (context instanceof Array) {
      var newObj = Object.create(null);
      context.push(newObj);
      context = newObj;
    } else {
      genError("Cannot redefine existing key '" + path + "'.", line, column);
    }
  }

  // Given a path 'a.b.c', create (as necessary) `start.a`,
  // `start.a.b`, and `start.a.b.c`, assigning `value` to `start.a.b.c`.
  // If `a` or `b` are arrays and have items in them, the last item in the
  // array is used as the context for the next sub-path.
  function deepRef(start, keys, value, line, column) {
    var traversed = [];
    var traversedPath = "";
    var path = keys.join(".");
    var ctx = start;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      traversed.push(key);
      traversedPath = traversed.join(".");
      if (typeof ctx[key] === "undefined") {
        if (i === keys.length - 1) {
          ctx[key] = value;
        } else {
          ctx[key] = Object.create(null);
        }
      } else if (i !== keys.length - 1 && valueAssignments.indexOf(traversedPath) > -1) {
        // already a non-object value at key, can't be used as part of a new path
        genError("Cannot redefine existing key '" + traversedPath + "'.", line, column);
      }

      ctx = ctx[key];
      if (ctx instanceof Array && ctx.length && i < keys.length - 1) {
        ctx = ctx[ctx.length - 1];
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
}

module.exports = {
  compile: compile
};

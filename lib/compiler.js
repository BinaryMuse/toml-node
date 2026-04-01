"use strict";
function compile(nodes, inputText) {
  var assignedPaths = new Set();
  var valueAssignments = new Set();
  var explicitTablePaths = new Set();
  var currentPath = "";
  var data = Object.create(null);
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
      var intermediatePath = currentPath ? currentPath + "." + keys.slice(0, i + 1).join(".") : keys.slice(0, i + 1).join(".");

      if (typeof target[k] === "undefined") {
        target[k] = Object.create(null);
        assignedPaths.add(intermediatePath);
      } else if (typeof target[k] !== "object" || target[k] === null || Array.isArray(target[k])) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", off);
      } else if (valueAssignments.has(intermediatePath)) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", off);
      } else if (explicitTablePaths.has(intermediatePath) && intermediatePath !== (Array.isArray(currentPath) ? currentPath.join(".") : currentPath)) {
        genError("Cannot use dotted keys to extend table '" + intermediatePath + "' defined elsewhere.", off);
      }
      target = target[k];
    }

    var lastKey = keys[keys.length - 1];
    var fullPath = currentPath ? currentPath + "." + keys.join(".") : keys.join(".");

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
    } else {
      return node.value;
    }
  }

  function reduceInlineTableNode(values) {
    var obj = Object.create(null);
    var definedKeys = new Set();

    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      if (val.type !== "InlineTableValue") continue;

      var keys = val.key;
      if (!Array.isArray(keys)) keys = [keys];

      var reduced = reduceValueNode(val.value);
      setNestedKey(obj, keys, reduced, val.offset, definedKeys);

      definedKeys.add(keys.join("."));
    }

    return obj;
  }

  function setNestedKey(obj, keys, value, off, definedKeys) {
    for (var i = 0; i < keys.length - 1; i++) {
      var k = keys[i];
      var intermediatePath = keys.slice(0, i + 1).join(".");
      if (typeof obj[k] === "undefined") {
        obj[k] = Object.create(null);
      } else if (typeof obj[k] !== "object" || obj[k] === null || Array.isArray(obj[k])) {
        genError("Cannot redefine existing key '" + intermediatePath + "'.", off);
      } else if (definedKeys && definedKeys.has(intermediatePath)) {
        genError("Cannot extend inline table '" + intermediatePath + "'.", off);
      }
      obj = obj[k];
    }
    var lastKey = keys[keys.length - 1];
    if (typeof obj[lastKey] !== "undefined") {
      genError("Cannot redefine existing key '" + keys.join(".") + "'.", off);
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
    context = deepRef(data, path, Object.create(null), off);
    currentPath = path;
  }

  function addTableArray(node) {
    var path = node.value;
    var quotedPath = path.map(quoteDottedString).join(".");
    var off = node.offset;

    if (valueAssignments.has(quotedPath)) {
      genError("Cannot append to statically defined array '" + quotedPath + "'.", off);
    }

    // Clear paths that start with this table array path
    assignedPaths.forEach(function(p) {
      if (p.indexOf(quotedPath) === 0) assignedPaths.delete(p);
    });
    valueAssignments.forEach(function(p) {
      if (p.indexOf(quotedPath) === 0) valueAssignments.delete(p);
    });
    assignedPaths.add(quotedPath);
    context = deepRef(data, path, [], off);
    currentPath = quotedPath;

    if (context instanceof Array) {
      var newObj = Object.create(null);
      context.push(newObj);
      context = newObj;
    } else {
      genError("Cannot redefine existing key '" + path + "'.", off);
    }
  }

  function deepRef(start, keys, value, off) {
    var traversedPath = "";
    var ctx = start;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      traversedPath = traversedPath ? traversedPath + "." + key : key;
      if (typeof ctx[key] === "undefined") {
        if (i === keys.length - 1) {
          ctx[key] = value;
        } else {
          ctx[key] = Object.create(null);
        }
      } else if (i !== keys.length - 1 && valueAssignments.has(traversedPath)) {
        genError("Cannot redefine existing key '" + traversedPath + "'.", off);
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

function compile(nodes) {
  "use strict";
  var assignedPaths = [];
  var currentPath = "";
  var data = {};
  var context = data;
  var arrayMode = false;

  return reduce(nodes);

  function reduce(nodes) {
    var node;
    for (var i in nodes) {
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
    var key = node.key;
    var value = node.value;
    var line = node.line;
    var column = node.column;

    var fullPath = currentPath + "." + key;
    if (typeof context[key] !== "undefined") {
      genError("Cannot redefine existing key '" + fullPath + "'.", line, column);
    }

    context[key] = reduceValueNode(value);

    if (assignedPaths.indexOf(fullPath) === -1) {
      assignedPaths.push(fullPath);
    }
  }

  function reduceValueNode(node) {
    if (node.type === "Array") {
      return reduceArrayWithTypeChecking(node.value);
    } else if (node.type === "InlineTable") {
      return reduceInlineTableNode(node.value);
    } else {
      return node.value;
    }
  }

  function reduceInlineTableNode(values) {
    var obj = {};
    for (var i = 0; i < values.length; i++) {
      var val = values[i];
      if (val.value.type === "InlineTable") {
        obj[val.key] = reduceInlineTableNode(val.value.value);
      } else if (val.type === "InlineTableValue") {
        obj[val.key] = reduceValueNode(val.value);
      }
    }

    return obj;
  }

  function setPath(node) {
    var path = node.value;
    var line = node.line;
    var column = node.column;

    checkPath(path, line, column);

    if (assignedPaths.indexOf(path) > -1) {
      genError("Cannot redefine existing key '" + path + "'.", line, column);
    }
    assignedPaths.push(path);
    context = deepRef(data, path, {});
    currentPath = path;
  }

  function addTableArray(node) {
    var path = node.value;
    var line = node.line;
    var column = node.column;

    checkPath(path, line, column);

    if (assignedPaths.indexOf(path) === -1) {
      assignedPaths.push(path);
    }
    assignedPaths = assignedPaths.filter(function(p) {
      return p.indexOf(path) !== 0;
    });
    assignedPaths.push(path);
    context = deepRef(data, path, []);
    currentPath = path;

    if (context instanceof Array) {
      var newObj = {};
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
  function deepRef(start, path, value) {
    var key;
    var keys = path.split(".");
    var ctx = start;

    for (var i in keys) {
      key = keys[i];
      if (typeof ctx[key] === "undefined") {
        if (i === String(keys.length - 1)) {
          ctx[key] = value;
        } else {
          ctx[key] = {};
        }
      }

      ctx = ctx[key];
      if (ctx instanceof Array && ctx.length && i < keys.length - 1) {
        ctx = ctx[ctx.length - 1];
      }
    }

    return ctx;
  }

  function reduceArrayWithTypeChecking(array) {
    // Ensure that all items in the array are of the same type
    var firstType = null;
    for(var i in array) {
      var node = array[i];
      if (firstType === null) {
        firstType = node.type;
      } else {
        if (node.type !== firstType) {
          genError("Cannot add value of type " + node.type + " to array of type " +
            firstType + ".", node.line, node.column);
        }
      }
    }

    // Recursively reduce array of nodes into array of the nodes' values
    return array.map(reduceValueNode);
  }

  function checkPath(path, line, column) {
    if (path[0] === ".") {
      genError("Cannot start a table key with '.'.", line, column);
    } else if (path[path.length - 1] === ".") {
      genError("Cannot end a table key with '.'.", line, column);
    }
  }
}

module.exports = {
  compile: compile
};

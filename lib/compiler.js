function compile(nodes) {
  var assignedPaths = [];
  var currentPath = '';
  var data = {};
  var context = data;
  var arrayMode = false;

  return reduce(nodes);

  function reduce(nodes) {
    var node;
    for (i in nodes) {
      node = nodes[i];
      switch (node.type) {
      case 'Assign':
        assign(node);
        break;
      case 'ObjectPath':
        setPath(node);
        break;
      case 'ArrayPath':
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

    var fullPath = currentPath + '.' + key;
    if (typeof context[key] !== 'undefined') {
      genError("Cannot redefine existing key '" + fullPath + "'.", line, column);
    }

    if (value.type == 'Array')
      context[key] = reduceArrayWithTypeChecking(value.value)
    else
      context[key] = value.value;

    if (assignedPaths.indexOf(fullPath) === -1) assignedPaths.push(fullPath);
  }

  function setPath(node) {
    var path = node.value;
    var line = node.line;
    var column = node.column;

    if (assignedPaths.indexOf(path) > -1) {
      genError("Cannot redefine existing table '" + path + "'.", line, column);
    }
    assignedPaths.push(path);
    createContext(data, path, {}, true);
  }

  function addTableArray(node) {
    var path = node.value;
    var line = node.line;
    var column = node.column;

    if (assignedPaths.indexOf(path) === -1) assignedPaths.push(path);
    createContext(data, path, [], true);

    if (context instanceof Array) {
      var newObj = {};
      context.push(newObj);
      context = newObj;
    }
  }

  // Given a path 'a.b.c', create (as necessary) `start.a`,
  // `start.a.b`, and `start.a.b.c`, assigning `value` to `start.a.b.c`
  // If `setPath` is true, sets `context` to `value`.
  function createContext(start, path, value, setContext) {
    var key;
    var keys = path.split('.');
    var ctx = start;

    for (i in keys) {
      key = keys[i];
      if (typeof ctx[key] === 'undefined') {
        if (i == keys.length - 1) {
          ctx[key] = value;
        } else {
          ctx[key] = {};
        }
      }

      ctx = ctx[key];
    }

    if (setContext) {
      context = ctx;
      currentPath = path;
    }
  }

  function reduceArrayWithTypeChecking(array) {
    // Ensure that all items in the array are of the same type
    var firstType = null;
    for(i in array) {
      var node = array[i];
      if (firstType == null) {
        firstType = node.type;
      } else {
        if (node.type != firstType) {
          genError("Cannot add value of type " + node.type + " to array of type " +
            node.type + ".", node.line, node.column);
        }
      }
    }

    // Recursively reduce array of nodes into array of the nodes' values
    return array.map(function(elem) {
      if (elem.type == 'Array') {
        return reduceArrayWithTypeChecking(elem.value);
      } else {
        return elem.value;
      }
    });
  }
};

module.exports = {
  compile: compile
};

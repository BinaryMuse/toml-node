var parser = require('./lib/parser');
var compiler = require('./lib/compiler');

module.exports = {
  parse: function(input) {
    var str = input.toString();
    var nodes = parser.parse(str);
    return compiler.compile(nodes, str);
  }
};

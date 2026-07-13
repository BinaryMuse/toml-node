var parser = require('./lib/parser');
var compiler = require('./lib/compiler');

module.exports = {
  parse: function(input, options) {
    var str = input.toString();
    var nodes = parser.parse(str, options);
    return compiler.compile(nodes, str, options);
  }
};

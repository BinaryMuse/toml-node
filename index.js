var parser = require('./lib/parser');
var compiler = require('./lib/compiler');

module.exports = {
  parse: function(input) {
    var normalized = String(input).replace(/\r\n/g, '\n');
    var nodes = parser.parse(normalized);
    return compiler.compile(nodes);
  }
};

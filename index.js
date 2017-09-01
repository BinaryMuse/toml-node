var parser = require('./lib/parser');
var compiler = require('./lib/compiler');

module.exports = {
  parse: function(input) {
    var nodes = parser.parse(input.toString());
    return compiler.compile(nodes);
  },

  _trace: function(input, tracer) {
    var startParse = process.hrtime();
    var nodes = parser.parse(input.toString(), {tracer: tracer});
    var parseDelta = process.hrtime(startParse);

    var startCompile = process.hrtime();
    var result = compiler.compile(nodes);
    var compileDelta = process.hrtime(startCompile);

    return {
      result: result,
      parseTime: (parseDelta[0] * 1e9 + parseDelta[1]) / 1000 / 1000,
      compileTime: (compileDelta[0] * 1e9 + compileDelta[1]) / 1000 / 1000
    }
  }
};

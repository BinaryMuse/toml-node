var Stream = require('stream');
var toml = require('./lib/toml');

module.exports = {
  parse: function(input) {
    return toml.parse(input.toString());
  }
};

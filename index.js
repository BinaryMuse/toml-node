var toml = require('./toml');

module.exports = {
  parse: function(input) {
    return toml.parse(input.toString());
  }
};

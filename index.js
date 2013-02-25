var Stream = require('stream');
var toml = require('./toml');

module.exports = {
  parse: function(input) {
    return toml.parse(input.toString());
  },
  createStream: function() {
    var stream = new Stream();
    var buffers = [];
    var bufLen = 0;
    stream.readable = true;
    stream.writable = true;

    var parse = function() {
      try {
        var str = Buffer.concat(buffers, bufLen);
        var results = toml.parse(str.toString());
        stream.emit('data', results);
      } catch(e) {
        stream.emit('error', e);
        stream.destroy();
      }
    };

    stream.write = function(buffer) {
      buffers.push(buffer);
      bufLen += buffer.length;
    };

    stream.end = function(buffer) {
      if (buffer) stream.write(buffer);
      this.writable = false;
      parse();
      stream.emit('end');
      stream.emit('close');
      stream.readable = false;
      stream.writable = false;
    };

    stream.destroy = stream.destroySoon = function() {
      stream.emit('end');
      stream.emit('close');
      stream.readable = false;
      stream.writable = false;
    };

    return stream;
  }
};

var Stream = require('stream');
var toml = require('./lib/toml');

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
        var str = "";
        if (Buffer.concat) {
          str = Buffer.concat(buffers, bufLen);
        } else { // Node 0.6
          for(var i = 0; i < buffers.length; i++) {
            console.log(buffers[i].toString())
            str += buffers[i].toString();
          }
        }
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

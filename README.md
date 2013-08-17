TOML Parser for Node.js
=======================

[![Build Status](https://travis-ci.org/BinaryMuse/toml-node.png?branch=master)](https://travis-ci.org/BinaryMuse/toml-node)

If you haven't heard of TOML, well you're just missing out. [Go check it out now.](https://github.com/mojombo/toml) Back? Good.

Instalation
-----------

toml-node is available via npm.

    npm install toml

Usage
-----

### Standalone

Say you have some awesome TOML in a variable called `someTomlString`. Maybe it came from the web; maybe it came from a file; wherever it came from, it came asynchronously! Let's turn that sucker into a JavaScript object.

```javascript
var toml = require('toml');
var data = toml.parse(someTomlString);
console.dir(data);
```

### Streaming

As of toml-node version 1.0, the streaming interface has been removed. Instead, use a module like [concat-stream](https://npmjs.org/package/concat-stream):

```javascript
var toml = require('toml');
var concat = require('concat-stream');
var fs = require('fs');

fs.createReadStream('tomlFile.toml', 'utf8').pipe(concat(function(data) {
  var parsed = toml.parse(data);
}));
```

Thanks [@ForbesLindesay](https://github.com/ForbesLindesay) for the suggestion.

TOML Spec Support
-----------------

toml-node supports the TOML spec as specified by [mojombo/toml@v0.1.0](https://github.com/mojombo/toml/tree/v0.1.0)

Building & Testing
------------------

toml-node uses [the PEG.js parser generator](http://pegjs.majda.cz/).

    npm install
    ./generate.sh
    npm test

Any changes to `src/toml.peg` requires a regeneration of the parser with `./generate.sh`.

toml-node is tested on Travis CI and is tested against:

 * Node 0.6
 * Node 0.8
 * Node 0.10
 * Node 0.11

License
-------

toml-node is licensed under the MIT license agreement. See the LICENSE file for more information.

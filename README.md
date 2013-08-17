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

    var toml = require('toml');
    var data = toml.parse(someTomlString);
    console.dir(data);

### Streaming

You can pipe a stream of TOML text into toml-node and it will emit a single `data` event with the parsed results once the stream is complete.

    var toml = require('toml');
    var fs = require('fs');
    fs.createReadStream('tomlFile.toml').pipe(toml.createStream()).on('data', function(results) {
      // `results` is your parsed TOML
    });

The stream will emit an `error` event in the case of an error while parsing the TOML document.

TOML Spec Support
-----------------

toml-node supports the TOML spec as specified by [mojombo/toml@v0.1.0](https://github.com/mojombo/toml/tree/v0.1.0)

Building & Tests
----------------

toml-node uses [the PEG.js parser generator](http://pegjs.majda.cz/).

    npm install
    ./generate.sh
    npm test

toml-node runs on Travis CI and is tested against:

 * Node 0.6
 * Node 0.8
 * Node 0.10
 * Node 0.11

License
-------

toml-node is licensed under the MIT license agreement. See the LICENSE file for more information.

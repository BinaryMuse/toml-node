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

Say you have some awesome TOML in a variable called `someTomlString`. Maybe it came from the web; maybe it came from a file; wherever it came from, it came asynchronously! Let's turn that sucker into a JavaScript object.

    var toml = require('toml');
    var data = toml.parse(someTomlString);
    console.dir(data);

Yet To Come
-----------

 * Streaming interface

Building & Tests
----------------

toml-node uses the Jison parser generator.

    npm install -g jison
    jison toml.jison # generates toml.js
    npm test

toml-node runs on Travis CI and is tested against:

 * Node 0.6
 * Node 0.8
 * Node 0.9

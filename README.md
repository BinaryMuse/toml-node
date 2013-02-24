TOML Parser for Node.js
=======================

If you haven't heard of TOML, well you're just missing out. [Go check it out now.](https://github.com/mojombo/toml) Back? Good.

Instalation
-----------

toml-node is available via npm.

    npm install toml

Usage
-----

    var toml = require('toml');
    var data = toml.parse(someTomlString);
    console.dir(data);

Yet To Come
-----------

 * Streaming interface

Hacking
-------

toml-node uses the Jison parser generator.

    npm install -g jison
    jison toml.jison # generates toml.js
    node test/smoke.js # basic smoke test against example.toml
    npm test # run all tests

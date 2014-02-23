#!/usr/bin/env bash

./node_modules/.bin/pegjs --cache src/toml.peg lib/parser.js && echo "Generated parser to lib/parser.js"

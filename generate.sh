#!/usr/bin/env bash

./node_modules/.bin/pegjs --track-line-and-column --cache src/toml.peg lib/toml.js

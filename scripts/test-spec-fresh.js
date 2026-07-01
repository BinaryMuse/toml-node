#!/usr/bin/env node
"use strict";

var childProcess = require("child_process");
var fs = require("fs");
var path = require("path");

var repoRoot = path.join(__dirname, "..");
var testCheckout = path.join(repoRoot, ".binarymuse", "toml-test");
var npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  var result = childProcess.spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

fs.rmSync(testCheckout, { recursive: true, force: true });
fs.mkdirSync(path.dirname(testCheckout), { recursive: true });

run("git", [
  "clone",
  "--depth",
  "1",
  "https://github.com/toml-lang/toml-test.git",
  testCheckout,
]);
run(npmCommand, ["run", "test:spec"]);

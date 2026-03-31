"use strict";

/**
 * toml-test spec compliance runner
 *
 * Runs the official toml-lang/toml-test suite against this parser and reports
 * results broken down by category and individual test.
 *
 * Usage:
 *   node test/spec-test.js                  # summary
 *   node test/spec-test.js --failures       # show failure details
 *   node test/spec-test.js --all            # show all test results
 *   node test/spec-test.js --json           # machine-readable output
 */

var fs = require("fs");
var path = require("path");
var toml = require("../index");
var parser = require("../lib/parser");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

var TESTS_DIR = path.join(__dirname, "..", ".binarymuse", "toml-test", "tests");
var FILES_LIST = path.join(TESTS_DIR, "files-toml-1.0.0");

// Known failures due to JS platform limitations, not parser bugs.
// These are excluded from the pass/fail exit code.
var KNOWN_FAILURES = [
  // Number can't represent 64-bit integers beyond Number.MAX_SAFE_INTEGER
  "valid/integer/long",
  // Node.js handles UTF-8 decoding at the engine level; invalid byte sequences
  // are replaced before the parser sees the data, so we can't reject them.
  "invalid/encoding/bad-codepoint",
  "invalid/encoding/bad-utf8-in-comment",
  "invalid/encoding/bad-utf8-in-multiline",
  "invalid/encoding/bad-utf8-in-multiline-literal",
  "invalid/encoding/bad-utf8-in-string",
  "invalid/encoding/bad-utf8-in-string-literal",
];

// ---------------------------------------------------------------------------
// Tagged JSON conversion
//
// The toml-test suite expects every leaf value wrapped as:
//   { "type": "<toml_type>", "value": "<string_representation>" }
// Tables become plain JSON objects, arrays become JSON arrays.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AST type extraction
//
// Walk the parser's AST nodes to build a map of path → TOML type.
// This lets us distinguish Float from Integer even when the JS number
// is identical (e.g., 3e2 = 300 is Float, not Integer).
// ---------------------------------------------------------------------------

function buildTypeMap(nodes) {
  var typeMap = {};
  var currentPath = [];

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.type === "ObjectPath") {
      currentPath = node.value;
    } else if (node.type === "ArrayPath") {
      currentPath = node.value;
    } else if (node.type === "Assign") {
      var keys = Array.isArray(node.key) ? node.key : [node.key];
      var fullPath = currentPath.concat(keys).join(".");
      collectTypes(typeMap, fullPath, node.value);
    }
  }
  return typeMap;
}

function collectTypes(typeMap, path, valueNode) {
  if (valueNode.type === "Float" || valueNode.type === "Integer") {
    typeMap[path] = valueNode.type === "Float" ? "float" : "integer";
  } else if (valueNode.type === "Date") {
    typeMap[path] = "datetime";
  } else if (valueNode.type === "LocalDateTime") {
    typeMap[path] = "datetime-local";
  } else if (valueNode.type === "LocalDate") {
    typeMap[path] = "date-local";
  } else if (valueNode.type === "LocalTime") {
    typeMap[path] = "time-local";
  } else if (valueNode.type === "Array") {
    for (var i = 0; i < valueNode.value.length; i++) {
      collectTypes(typeMap, path + "." + i, valueNode.value[i]);
    }
  } else if (valueNode.type === "InlineTable") {
    for (var j = 0; j < valueNode.value.length; j++) {
      var entry = valueNode.value[j];
      var entryKeys = Array.isArray(entry.key) ? entry.key : [entry.key];
      collectTypes(typeMap, path + "." + entryKeys.join("."), entry.value);
    }
  }
}

function toTaggedJSON(value, typeMap, currentPath) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return { type: "datetime", value: formatDatetime(value) };
  }

  if (Array.isArray(value)) {
    return value.map(function (item, i) {
      return toTaggedJSON(item, typeMap, currentPath + "." + i);
    });
  }

  if (typeof value === "object") {
    var result = {};
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      var childPath = currentPath ? currentPath + "." + keys[i] : keys[i];
      result[keys[i]] = toTaggedJSON(value[keys[i]], typeMap, childPath);
    }
    return result;
  }

  if (typeof value === "string") {
    // Check if this is a local date/time type
    var strType = typeMap ? typeMap[currentPath] : null;
    if (strType === "datetime-local" || strType === "date-local" || strType === "time-local") {
      return { type: strType, value: value };
    }
    return { type: "string", value: value };
  }

  if (typeof value === "boolean") {
    return { type: "bool", value: String(value) };
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return { type: "float", value: "nan" };
    }
    if (!Number.isFinite(value)) {
      return { type: "float", value: value > 0 ? "inf" : "-inf" };
    }

    // Use AST type map if available to distinguish float from integer
    var astType = typeMap ? typeMap[currentPath] : null;
    if (astType === "float") {
      return { type: "float", value: formatFloat(value) };
    }
    if (astType === "integer") {
      return { type: "integer", value: String(value) };
    }

    // Fallback heuristic when type map doesn't have info
    if (Number.isInteger(value)) {
      return { type: "integer", value: String(value) };
    }
    return { type: "float", value: formatFloat(value) };
  }

  return { type: "string", value: String(value) };
}

function formatDatetime(d) {
  return d.toISOString().replace(/\.000Z$/, "Z").replace("Z", "+00:00");
}

function formatFloat(f) {
  // toml-test expects floats to have a decimal point or be in scientific notation
  var s = String(f);
  if (s.indexOf(".") === -1 && s.indexOf("e") === -1 && s.indexOf("E") === -1) {
    s = s + ".0";
  }
  return s;
}

// ---------------------------------------------------------------------------
// Deep comparison of tagged JSON structures
// ---------------------------------------------------------------------------

function deepEqual(actual, expected, path) {
  path = path || "";

  if (actual === expected) return null;
  if (actual === null || actual === undefined) {
    return path + ": expected " + JSON.stringify(expected) + " but got " + actual;
  }
  if (expected === null || expected === undefined) {
    return path + ": expected " + expected + " but got " + JSON.stringify(actual);
  }

  // Both are tagged values
  if (expected.type && expected.value !== undefined && typeof expected.type === "string") {
    if (!actual.type) {
      return path + ": expected tagged value {type:" + expected.type + "} but got " + JSON.stringify(actual);
    }
    if (actual.type !== expected.type) {
      return path + ": type mismatch: got '" + actual.type + "' expected '" + expected.type + "'";
    }

    // Compare values with type-aware logic
    if (expected.type === "float") {
      return compareFloats(actual.value, expected.value, path);
    }
    if (expected.type === "datetime" || expected.type === "datetime-local" ||
        expected.type === "date-local" || expected.type === "time-local") {
      return compareDatetimes(actual.value, expected.value, path);
    }

    if (actual.value !== expected.value) {
      return path + ": value mismatch: got " + JSON.stringify(actual.value) + " expected " + JSON.stringify(expected.value);
    }
    return null;
  }

  // Both are arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return path + ": expected array but got " + typeof actual;
    }
    if (actual.length !== expected.length) {
      return path + ": array length mismatch: got " + actual.length + " expected " + expected.length;
    }
    for (var i = 0; i < expected.length; i++) {
      var err = deepEqual(actual[i], expected[i], path + "[" + i + "]");
      if (err) return err;
    }
    return null;
  }

  // Both are objects (tables)
  if (typeof expected === "object" && typeof actual === "object") {
    var expectedKeys = Object.keys(expected).sort();
    var actualKeys = Object.keys(actual).sort();

    // Check for missing keys
    for (var j = 0; j < expectedKeys.length; j++) {
      if (actualKeys.indexOf(expectedKeys[j]) === -1) {
        return path + ": missing key '" + expectedKeys[j] + "'";
      }
    }
    // Check for extra keys
    for (var k = 0; k < actualKeys.length; k++) {
      if (expectedKeys.indexOf(actualKeys[k]) === -1) {
        return path + ": unexpected key '" + actualKeys[k] + "'";
      }
    }
    // Compare values
    for (var m = 0; m < expectedKeys.length; m++) {
      var key = expectedKeys[m];
      var err2 = deepEqual(actual[key], expected[key], path ? path + "." + key : key);
      if (err2) return err2;
    }
    return null;
  }

  return path + ": " + JSON.stringify(actual) + " !== " + JSON.stringify(expected);
}

function compareFloats(actual, expected, path) {
  if (expected === "nan" || expected === "+nan" || expected === "-nan") {
    if (actual === "nan" || actual === "+nan" || actual === "-nan") return null;
    return path + ": expected nan but got " + actual;
  }
  if (expected === "inf" || expected === "+inf") {
    if (actual === "inf" || actual === "+inf") return null;
    return path + ": expected inf but got " + actual;
  }
  if (expected === "-inf") {
    if (actual === "-inf") return null;
    return path + ": expected -inf but got " + actual;
  }
  // Numeric comparison for floats to handle precision
  var actualNum = parseFloat(actual);
  var expectedNum = parseFloat(expected);
  if (Math.abs(actualNum - expectedNum) < 1e-15) return null;
  if (actual !== expected) {
    return path + ": float mismatch: got " + actual + " expected " + expected;
  }
  return null;
}

function compareDatetimes(actual, expected, path) {
  // Normalize and compare datetimes
  if (actual === expected) return null;

  // Try parsing both to see if they represent the same instant
  var da = new Date(actual);
  var de = new Date(expected);
  if (!isNaN(da.getTime()) && !isNaN(de.getTime()) && da.getTime() === de.getTime()) {
    return null;
  }

  if (actual !== expected) {
    return path + ": datetime mismatch: got " + JSON.stringify(actual) + " expected " + JSON.stringify(expected);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

function loadFileList() {
  var content = fs.readFileSync(FILES_LIST, "utf8");
  var lines = content.trim().split("\n").filter(function (l) { return l.length > 0; });
  var valid = [];
  var invalid = [];
  lines.forEach(function (line) {
    if (line.indexOf("valid/") === 0) {
      // strip the .toml extension to get test name
      valid.push(line.replace(/\.toml$/, "").replace(/\.json$/, ""));
    } else if (line.indexOf("invalid/") === 0) {
      invalid.push(line.replace(/\.toml$/, ""));
    }
  });
  // Deduplicate (valid tests appear twice: once for .toml, once for .json)
  valid = valid.filter(function (v, i, self) { return self.indexOf(v) === i; });
  invalid = invalid.filter(function (v, i, self) { return self.indexOf(v) === i; });
  return { valid: valid, invalid: invalid };
}

function runValidTest(testPath) {
  var tomlFile = path.join(TESTS_DIR, testPath + ".toml");
  var jsonFile = path.join(TESTS_DIR, testPath + ".json");

  var tomlContent, expectedJSON;
  try {
    tomlContent = fs.readFileSync(tomlFile, "utf8");
  } catch (e) {
    return { pass: false, error: "Could not read .toml file: " + e.message };
  }
  try {
    expectedJSON = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
  } catch (e) {
    return { pass: false, error: "Could not read/parse .json file: " + e.message };
  }

  try {
    var astNodes = parser.parse(tomlContent);
    var typeMap = buildTypeMap(astNodes);
    var parsed = toml.parse(tomlContent);
    var tagged = toTaggedJSON(parsed, typeMap, "");
    var diff = deepEqual(tagged, expectedJSON);
    if (diff) {
      return { pass: false, error: diff };
    }
    return { pass: true };
  } catch (e) {
    return { pass: false, error: "Parse error: " + e.message };
  }
}

function runInvalidTest(testPath) {
  var tomlFile = path.join(TESTS_DIR, testPath + ".toml");
  var tomlContent;
  try {
    tomlContent = fs.readFileSync(tomlFile, "utf8");
  } catch (e) {
    return { pass: false, error: "Could not read .toml file: " + e.message };
  }

  try {
    toml.parse(tomlContent);
    return { pass: false, error: "Expected parse error but parsing succeeded" };
  } catch (e) {
    return { pass: true };
  }
}

function categorize(testPath) {
  // e.g. "valid/string/escapes" -> "string"
  // e.g. "invalid/array/no-close-01" -> "array"
  var parts = testPath.split("/");
  if (parts.length >= 3) return parts[1];
  return parts[1] ? parts[1].replace(/\..*/, "").replace(/-\d+$/, "") : "root";
}

function run() {
  var args = process.argv.slice(2);
  var showFailures = args.indexOf("--failures") !== -1;
  var showAll = args.indexOf("--all") !== -1;
  var jsonOutput = args.indexOf("--json") !== -1;

  var files = loadFileList();
  var results = {
    valid: { pass: 0, fail: 0, tests: [], byCategory: {} },
    invalid: { pass: 0, fail: 0, tests: [], byCategory: {} }
  };

  // Run valid tests
  files.valid.forEach(function (testPath) {
    var result = runValidTest(testPath);
    var cat = categorize(testPath);
    if (!results.valid.byCategory[cat]) {
      results.valid.byCategory[cat] = { pass: 0, fail: 0, failures: [] };
    }
    if (result.pass) {
      results.valid.pass++;
      results.valid.byCategory[cat].pass++;
    } else {
      results.valid.fail++;
      results.valid.byCategory[cat].fail++;
      results.valid.byCategory[cat].failures.push({ test: testPath, error: result.error });
    }
    results.valid.tests.push({ test: testPath, pass: result.pass, error: result.error });
  });

  // Run invalid tests
  files.invalid.forEach(function (testPath) {
    var result = runInvalidTest(testPath);
    var cat = categorize(testPath);
    if (!results.invalid.byCategory[cat]) {
      results.invalid.byCategory[cat] = { pass: 0, fail: 0, failures: [] };
    }
    if (result.pass) {
      results.invalid.pass++;
      results.invalid.byCategory[cat].pass++;
    } else {
      results.invalid.fail++;
      results.invalid.byCategory[cat].fail++;
      results.invalid.byCategory[cat].failures.push({ test: testPath, error: result.error });
    }
    results.invalid.tests.push({ test: testPath, pass: result.pass, error: result.error });
  });

  if (jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Print results
  var totalPass = results.valid.pass + results.invalid.pass;
  var totalFail = results.valid.fail + results.invalid.fail;
  var total = totalPass + totalFail;

  console.log("==========================================================");
  console.log("  TOML Spec Compliance Test Results (TOML v1.0.0)");
  console.log("==========================================================");
  console.log("");
  console.log("  Total:   " + totalPass + "/" + total + " passed (" + pct(totalPass, total) + ")");
  console.log("  Valid:   " + results.valid.pass + "/" + (results.valid.pass + results.valid.fail) + " passed (" + pct(results.valid.pass, results.valid.pass + results.valid.fail) + ")");
  console.log("  Invalid: " + results.invalid.pass + "/" + (results.invalid.pass + results.invalid.fail) + " passed (" + pct(results.invalid.pass, results.invalid.pass + results.invalid.fail) + ")");
  console.log("");

  // Valid tests by category
  console.log("----------------------------------------------------------");
  console.log("  VALID TESTS (should parse successfully)");
  console.log("----------------------------------------------------------");
  printCategoryTable(results.valid.byCategory);

  console.log("");
  console.log("----------------------------------------------------------");
  console.log("  INVALID TESTS (should reject)");
  console.log("----------------------------------------------------------");
  printCategoryTable(results.invalid.byCategory);

  // Show failures if requested
  if (showFailures || showAll) {
    console.log("");
    console.log("----------------------------------------------------------");
    console.log("  FAILURE DETAILS");
    console.log("----------------------------------------------------------");

    var validFailures = results.valid.tests.filter(function (t) { return !t.pass; });
    if (validFailures.length > 0) {
      console.log("");
      console.log("  Valid tests that FAILED (" + validFailures.length + "):");
      validFailures.forEach(function (t) {
        console.log("    FAIL " + t.test);
        console.log("         " + t.error);
      });
    }

    var invalidFailures = results.invalid.tests.filter(function (t) { return !t.pass; });
    if (invalidFailures.length > 0) {
      console.log("");
      console.log("  Invalid tests that should have REJECTED (" + invalidFailures.length + "):");
      invalidFailures.forEach(function (t) {
        console.log("    FAIL " + t.test);
        console.log("         " + t.error);
      });
    }
  }

  if (showAll) {
    console.log("");
    console.log("----------------------------------------------------------");
    console.log("  ALL PASSING TESTS");
    console.log("----------------------------------------------------------");
    results.valid.tests.filter(function (t) { return t.pass; }).forEach(function (t) {
      console.log("    PASS " + t.test);
    });
    results.invalid.tests.filter(function (t) { return t.pass; }).forEach(function (t) {
      console.log("    PASS " + t.test);
    });
  }

  // Determine unexpected failures (not in KNOWN_FAILURES list)
  var allFailures = results.valid.tests.concat(results.invalid.tests).filter(function (t) { return !t.pass; });
  var knownCount = 0;
  var unexpectedFailures = [];
  allFailures.forEach(function (t) {
    if (KNOWN_FAILURES.indexOf(t.test) !== -1) {
      knownCount++;
    } else {
      unexpectedFailures.push(t);
    }
  });

  console.log("");
  if (knownCount > 0) {
    console.log("  Known failures (JS platform limitations): " + knownCount);
  }
  if (unexpectedFailures.length > 0) {
    console.log("  UNEXPECTED FAILURES: " + unexpectedFailures.length);
    unexpectedFailures.forEach(function (t) {
      console.log("    FAIL " + t.test);
      console.log("         " + t.error);
    });
  }
  console.log("");

  // Exit with error code only for unexpected failures
  process.exit(unexpectedFailures.length > 0 ? 1 : 0);
}

function pct(n, total) {
  if (total === 0) return "N/A";
  return (n / total * 100).toFixed(1) + "%";
}

function printCategoryTable(categories) {
  var cats = Object.keys(categories).sort();
  var maxLen = 0;
  cats.forEach(function (c) { if (c.length > maxLen) maxLen = c.length; });

  cats.forEach(function (cat) {
    var c = categories[cat];
    var total = c.pass + c.fail;
    var pad = new Array(maxLen - cat.length + 1).join(" ");
    var status = c.fail === 0 ? " ✓" : " ✗";
    console.log("  " + status + " " + cat + pad + "  " + c.pass + "/" + total + " (" + pct(c.pass, total) + ")");
  });
}

run();

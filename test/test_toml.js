"use strict";

var { describe, it } = require("node:test");
var assert = require("node:assert");
var toml = require("../");
var fs = require("fs");
var path = require("path");

function parsesToml(tomlStr, expected) {
  var actual;
  try {
    actual = toml.parse(tomlStr);
  } catch (e) {
    assert.fail(
      "TOML parse error at line " + e.line + ", column " + e.column + ": " + e.message
    );
  }
  // The compiler uses Object.create(null), so we normalize prototypes via
  // a custom recursive comparison that treats null-prototype objects like {}.
  assert.deepStrictEqual(normalize(actual), normalize(expected));
}

function normalize(val) {
  if (val instanceof Date) return val;
  if (Array.isArray(val)) return val.map(normalize);
  if (val !== null && typeof val === "object") {
    var out = {};
    var keys = Object.keys(val);
    for (var i = 0; i < keys.length; i++) {
      out[keys[i]] = normalize(val[keys[i]]);
    }
    return out;
  }
  return val;
}

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, name), "utf8");
}

// ---------------------------------------------------------------------------
// Expected values for fixture files
// ---------------------------------------------------------------------------

var exampleExpected = {
  title: "TOML Example",
  owner: {
    name: "Tom Preston-Werner",
    organization: "GitHub",
    bio: "GitHub Cofounder & CEO\n\tLikes \"tater tots\" and beer and backslashes: \\",
    dob: new Date("1979-05-27T07:32:00Z"),
  },
  database: {
    server: "192.168.1.1",
    ports: [8001, 8001, 8003],
    connection_max: 5000,
    connection_min: -2,
    max_temp: 87.1,
    min_temp: -17.76,
    enabled: true,
  },
  servers: {
    alpha: { ip: "10.0.0.1", dc: "eqdc10" },
    beta: { ip: "10.0.0.2", dc: "eqdc10" },
  },
  clients: {
    data: [
      ["gamma", "delta"],
      [1, 2],
    ],
  },
};

var hardExampleExpected = {
  the: {
    hard: {
      another_test_string: " Same thing, but with a string #",
      "bit#": {
        multi_line_array: ["]"],
        "what?": "You don't think some user won't do that?",
      },
      harder_test_string: ' And when "\'s are in the string, along with # "',
      test_array: ["] ", " # "],
      test_array2: ["Test #11 ]proved that", "Experiment #9 was a success"],
    },
    test_string: "You'll hate me after this - #",
  },
};

var easyTableArrayExpected = {
  products: [
    { name: "Hammer", sku: 738594937 },
    {},
    { name: "Nail", sku: 284758393, color: "gray" },
  ],
};

var hardTableArrayExpected = {
  fruit: [
    { name: "durian", variety: [] },
    {
      name: "apple",
      physical: { color: "red", shape: "round" },
      variety: [{ name: "red delicious" }, { name: "granny smith" }],
    },
    {},
    { name: "banana", variety: [{ name: "plantain" }] },
    { name: "orange", physical: { color: "orange", shape: "round" } },
  ],
};

var badInputs = [
  "[error]   if you didn't catch this, your parser is broken",
  'string = "Anything other than tabs, spaces and newline after a table or key value pair has ended should produce an error unless it is a comment"   like this',
  'array = [\n           "This might most likely happen in multiline arrays",\n           Like here,\n           "or here,\n           and here"\n           ]     End of array comment, forgot the #',
  "number = 3.14  pi <--again forgot the #",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fixture files", function () {
  it("parses example.toml", function () {
    parsesToml(readFixture("example.toml"), exampleExpected);
  });

  it("parses hard_example.toml", function () {
    parsesToml(readFixture("hard_example.toml"), hardExampleExpected);
  });

  it("parses easy table arrays", function () {
    parsesToml(readFixture("table_arrays_easy.toml"), easyTableArrayExpected);
  });

  it("parses hard table arrays", function () {
    parsesToml(readFixture("table_arrays_hard.toml"), hardTableArrayExpected);
  });
});

describe("arrays", function () {
  it("supports trailing commas", function () {
    parsesToml("arr = [1, 2, 3,]", { arr: [1, 2, 3] });
  });

  it("single element with no trailing comma", function () {
    parsesToml("a = [1]", { a: [1] });
  });

  it("empty array", function () {
    parsesToml("a = []", { a: [] });
  });

  it("array with whitespace", function () {
    parsesToml("[versions]\nfiles = [\n 3, \n    5 \n\n ]", {
      versions: { files: [3, 5] },
    });
  });

  it("empty array with whitespace", function () {
    parsesToml("[versions]\nfiles = [\n  \n  ]", {
      versions: { files: [] },
    });
  });
});

describe("tables", function () {
  it("define on superkey", function () {
    parsesToml("[a.b]\nc = 1\n\n[a]\nd = 2", {
      a: { b: { c: 1 }, d: 2 },
    });
  });

  it("whitespace around key names", function () {
    parsesToml("[ a ]\nb = 1", { a: { b: 1 } });
  });

  it("whitespace around dots", function () {
    parsesToml("[ a . b . c]\nd = 1", { a: { b: { c: { d: 1 } } } });
  });
});

describe("inline tables", function () {
  it("parses inline tables", function () {
    parsesToml(readFixture("inline_tables.toml"), {
      name: { first: "Tom", last: "Preston-Werner" },
      point: { x: 1, y: 2 },
      nested: { x: { a: { b: 3 } } },
      points: [
        { x: 1, y: 2, z: 3 },
        { x: 7, y: 8, z: 9 },
        { x: 2, y: 4, z: 8 },
      ],
      arrays: [
        { x: [1, 2, 3], y: [4, 5, 6] },
        { x: [7, 8, 9], y: [0, 1, 2] },
      ],
    });
  });

  it("parses empty inline tables", function () {
    parsesToml("a = { }", { a: {} });
  });
});

describe("strings", function () {
  it("unicode escapes", function () {
    parsesToml('str = "My name is Jos\\u00E9"', { str: "My name is Jos\u00E9" });
    parsesToml('str = "My name is Jos\\U000000E9"', { str: "My name is Jos\u00E9" });
  });

  it("multiline strings", function () {
    parsesToml(readFixture("multiline_strings.toml"), {
      key1: "One\nTwo",
      key2: "One\nTwo",
      key3: "One\nTwo",
    });
  });

  it("multiline eat whitespace", function () {
    parsesToml(readFixture("multiline_eat_whitespace.toml"), {
      key1: "The quick brown fox jumps over the lazy dog.",
      key2: "The quick brown fox jumps over the lazy dog.",
      key3: "The quick brown fox jumps over the lazy dog.",
    });
  });

  it("literal strings", function () {
    parsesToml(readFixture("literal_strings.toml"), {
      winpath: "C:\\Users\\nodejs\\templates",
      winpath2: "\\\\ServerX\\admin$\\system32\\",
      quoted: 'Tom "Dubs" Preston-Werner',
      regex: "<\\i\\c*\\s*>",
    });
  });

  it("multiline literal strings", function () {
    parsesToml(readFixture("multiline_literal_strings.toml"), {
      regex2: "I [dw]on't need \\d{2} apples",
      lines:
        "The first newline is\ntrimmed in raw strings.\n   All other whitespace\n   is preserved.\n",
    });
  });
});

describe("numbers", function () {
  it("integer formats", function () {
    parsesToml(
      "a = +99\nb = 42\nc = 0\nd = -17\ne = 1_000_001\nf = 1_2_3_4_5   # why u do dis",
      { a: 99, b: 42, c: 0, d: -17, e: 1000001, f: 12345 }
    );
  });

  it("float formats", function () {
    parsesToml(
      "a = +1.0\nb = 3.1415\nc = -0.01\n" +
        "d = 5e+22\ne = 1e6\nf = -2E-2\n" +
        "g = 6.626e-34\n" +
        "h = 9_224_617.445_991_228_313\n" +
        "i = 1e1_000",
      {
        a: 1.0,
        b: 3.1415,
        c: -0.01,
        d: 5e22,
        e: 1e6,
        f: -2e-2,
        g: 6.626e-34,
        h: 9224617.445991228313,
        i: 1e1000,
      }
    );
  });
});

describe("whitespace", function () {
  it("handles whitespace", function () {
    parsesToml("a = 1\n  \n  b = 2  ", { a: 1, b: 2 });
  });

  it("leading newlines", function () {
    parsesToml("\ntest = \"ing\"", { test: "ing" });
  });
});

describe("datetimes", function () {
  it("parses UTC dates", function () {
    parsesToml("a = 1979-05-27T07:32:00Z", {
      a: new Date("1979-05-27T07:32:00Z"),
    });
  });

  it("parses dates with offsets", function () {
    parsesToml("a = 1979-05-27T07:32:00-07:00\nb = 1979-05-27T07:32:00+02:00", {
      a: new Date("1979-05-27T07:32:00-07:00"),
      b: new Date("1979-05-27T07:32:00+02:00"),
    });
  });

  it("parses dates with fractional seconds", function () {
    parsesToml("a = 1979-05-27T00:32:00.999999-07:00", {
      a: new Date("1979-05-27T00:32:00.999999-07:00"),
    });
  });

  it("parses dates from Date.toISOString()", function () {
    var date = new Date();
    parsesToml("a = " + date.toISOString(), { a: date });
  });
});

describe("quoted keys", function () {
  it("simple quoted key", function () {
    parsesToml('["ʞ"]\na = 1', { ʞ: { a: 1 } });
  });

  it("complex quoted key", function () {
    parsesToml('[ a . "ʞ" . c ]\nd = 1', { a: { ʞ: { c: { d: 1 } } } });
  });

  it("escaped quotes in quoted keys", function () {
    parsesToml('["the \\"thing\\""]\na = true', { 'the "thing"': { a: true } });
  });

  it("more complex quoted keys", function () {
    parsesToml('["the\\\\ key"]\n\none = "one"\ntwo = 2\nthree = false', {
      "the\\ key": { one: "one", two: 2, three: false },
    });
    parsesToml('[a."the\\\\ key"]\n\none = "one"\ntwo = 2\nthree = false', {
      a: { "the\\ key": { one: "one", two: 2, three: false } },
    });
    parsesToml('[a."the-key"]\n\none = "one"\ntwo = 2\nthree = false', {
      a: { "the-key": { one: "one", two: 2, three: false } },
    });
    parsesToml('[a."the.key"]\n\none = "one"\ntwo = 2\nthree = false', {
      a: { "the.key": { one: "one", two: 2, three: false } },
    });
    parsesToml("[table]\n'a \"quoted value\"' = \"value\"", {
      table: { 'a "quoted value"': "value" },
    });
    parsesToml('[module]\n"foo=bar" = "zzz"', {
      module: { "foo=bar": "zzz" },
    });
  });
});

describe("error handling", function () {
  it("rejects bad unicode", function () {
    assert.throws(function () {
      toml.parse('str = "My name is Jos\\uD800"');
    });
  });

  it("rejects dot at start of key", function () {
    assert.throws(function () {
      toml.parse("[.a]\nb = 1");
    });
  });

  it("rejects dot at end of key", function () {
    assert.throws(function () {
      toml.parse("[a.]\nb = 1");
    });
  });

  it("rejects table override", function () {
    assert.throws(function () {
      toml.parse("[a]\nb = 1\n\n[a]\nc = 2");
    });
  });

  it("rejects key override", function () {
    assert.throws(function () {
      toml.parse("[a]\nb = 1\n[a.b]\nc = 2");
    });
  });

  it("rejects key override with nested path", function () {
    assert.throws(function () {
      toml.parse('[a]\nb = "a"\n[a.b.c]');
    });
  });

  it("rejects key override with array table", function () {
    assert.throws(function () {
      toml.parse("[a]\nb = 1\n[[a]]\nc = 2");
    });
  });

  it("rejects key replace", function () {
    assert.throws(function () {
      toml.parse("[a]\nb = 1\nb = 2");
    });
  });

  it("rejects inline table replace", function () {
    assert.throws(function () {
      toml.parse("a = { b = 1 }\n[a]\nc = 2");
    });
  });

  it("rejects array type mismatch", function () {
    assert.throws(function () {
      toml.parse('data = [1, 2, "test"]');
    });
  });

  it("rejects bad inputs", function () {
    badInputs.forEach(function (input) {
      assert.throws(function () {
        toml.parse(input);
      });
    });
  });

  it("errors have correct line and column", function () {
    try {
      toml.parse("[a]\nb = 1\n [a.b]\nc = 2");
      assert.fail("Should have thrown");
    } catch (e) {
      assert.strictEqual(e.line, 3);
      assert.strictEqual(e.column, 2);
    }
  });
});

describe("edge cases", function () {
  it("using 'constructor' as key", function () {
    parsesToml("[empty]\n[emptier]\n[constructor]\nconstructor = 1\n[emptiest]", {
      empty: {},
      emptier: {},
      constructor: { constructor: 1 },
      emptiest: {},
    });
  });
});

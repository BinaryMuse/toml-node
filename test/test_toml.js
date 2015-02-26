var toml = require('../');
var fs = require('fs');

var exampleExpected = {
  title: "TOML Example",
  owner: {
    name: "Tom Preston-Werner",
    organization: "GitHub",
    bio: "GitHub Cofounder & CEO\n\tLikes \"tater tots\" and beer and backslashes: \\",
    dob: new Date("1979-05-27T07:32:00Z")
  },
  database: {
    server: "192.168.1.1",
    ports: [8001, 8001, 8003],
    connection_max: 5000,
    connection_min: -2,
    max_temp: 87.1,
    min_temp: -17.76,
    enabled: true
  },
  servers: {
    alpha: {
      ip: "10.0.0.1",
      dc: "eqdc10"
    },
    beta: {
      ip: "10.0.0.2",
      dc: "eqdc10"
    }
  },
  clients: {
    data: [ ["gamma", "delta"], [1, 2] ]
  }
};

var hardExampleExpected = {
  the: {
    hard: {
      another_test_string: ' Same thing, but with a string #',
      'bit#': {
        multi_line_array: [']'],
        'what?': "You don't think some user won't do that?"
      },
      harder_test_string: " And when \"'s are in the string, along with # \"",
      test_array: ['] ', ' # '],
      test_array2: ['Test #11 ]proved that', 'Experiment #9 was a success']
    },
    test_string: "You'll hate me after this - #"
  }
};

var easyTableArrayExpected = {
  "products": [
    { "name": "Hammer", "sku": 738594937 },
    { },
    { "name": "Nail", "sku": 284758393, "color": "gray" }
  ]
};

var hardTableArrayExpected = {
  "fruit": [
    {
      "name": "apple",
      "physical": {
        "color": "red",
        "shape": "round"
      },
      "variety": [
        { "name": "red delicious" },
        { "name": "granny smith" }
      ]
    },
    {},
    {
      "name": "banana",
      "variety": [
        { "name": "plantain" }
      ]
    },
    {
      "name": "orange",
      "physical": {
        "color": "orange",
        "shape": "round"
      }
    }
  ]
}

var badInputs = [
  '[error]   if you didn\'t catch this, your parser is broken',
  'string = "Anything other than tabs, spaces and newline after a table or key value pair has ended should produce an error unless it is a comment"   like this',
  'array = [\n           \"This might most likely happen in multiline arrays\",\n           Like here,\n           \"or here,\n           and here\"\n           ]     End of array comment, forgot the #',
  'number = 3.14  pi <--again forgot the #'
];

exports.testParsesExample = function(test) {
  var str = fs.readFileSync(__dirname + "/example.toml", 'utf-8')
  test.deepEqual(toml.parse(str), exampleExpected);
  test.done();
};

exports.testParsesHardExample = function(test) {
  var str = fs.readFileSync(__dirname + "/hard_example.toml", 'utf-8')
  test.deepEqual(toml.parse(str), hardExampleExpected);
  test.done();
};

exports.testEasyTableArrays = function(test) {
  var str = fs.readFileSync(__dirname + "/table_arrays_easy.toml", 'utf8')
  test.deepEqual(toml.parse(str), easyTableArrayExpected);
  test.done();
};

exports.testHarderTableArrays = function(test) {
  var str = fs.readFileSync(__dirname + "/table_arrays_hard.toml", 'utf8')
  test.deepEqual(toml.parse(str), hardTableArrayExpected);
  test.done();
};

exports.testSupportsTrailingCommasInArrays = function(test) {
  var str = 'arr = [1, 2, 3,]';
  var expected = { arr: [1, 2, 3] };
  var results = toml.parse(str);
  test.deepEqual(results, expected);
  test.done();
};

exports.testSingleElementArrayWithNoTrailingComma = function(test) {
  var str = "a = [1]";
  test.deepEqual(toml.parse(str), {
    a: [1]
  });
  test.done();
};

exports.testEmptyArray = function(test) {
  var str = "a = []";
  test.deepEqual(toml.parse(str), {
    a: []
  });
  test.done();
};

exports.testArrayWithWhitespace = function(test) {
  var str = "[versions]\nfiles = [\n 3, \n    5 \n\n ]";
  test.deepEqual(toml.parse(str), {
    versions: {
      files: [3, 5]
    }
  });
  test.done();
};

exports.testEmptyArrayWithWhitespace = function(test) {
  var str = "[versions]\nfiles = [\n  \n  ]";
  test.deepEqual(toml.parse(str), {
    versions: {
      files: []
    }
  });
  test.done();
};

exports.textDefineOnSuperkey = function(test) {
  var str = "[a.b]\nc = 1\n\n[a]\nd = 2";
  var expected = {
    a: {
      b: {
        c: 1
      },
      d: 2
    }
  };
  test.deepEqual(toml.parse(str), expected);
  test.done();
};

exports.testWhitespace = function(test) {
  var str = "a = 1\n  \n  b = 2  ";
  test.deepEqual(toml.parse(str), {
    a: 1, b: 2
  });
  test.done();
};

exports.testUnicode = function(test) {
  var str = "str = \"My name is Jos\\u00E9\"";
  test.deepEqual(toml.parse(str), {
    str: "My name is Jos\u00E9"
  });

  var str = "str = \"My name is Jos\\U000000E9\"";
  test.deepEqual(toml.parse(str), {
    str: "My name is Jos\u00E9"
  });
  test.done();
};

exports.testMultilineStrings = function(test) {
  var str = fs.readFileSync(__dirname + "/multiline_strings.toml", 'utf8');
  test.deepEqual(toml.parse(str), {
    key1: "One\nTwo",
    key2: "One\nTwo",
    key3: "One\nTwo"
  });
  test.done();
};

exports.testMultilineEatWhitespace = function(test) {
  var str = fs.readFileSync(__dirname + "/multiline_eat_whitespace.toml", 'utf8');
  test.deepEqual(toml.parse(str), {
    key1: "The quick brown fox jumps over the lazy dog.",
    key2: "The quick brown fox jumps over the lazy dog.",
    key3: "The quick brown fox jumps over the lazy dog."
  });
  test.done();
};

exports.testLiteralStrings = function(test) {
  var str = fs.readFileSync(__dirname + "/literal_strings.toml", 'utf8');
  test.deepEqual(toml.parse(str), {
    winpath: "C:\\Users\\nodejs\\templates",
    winpath2: "\\\\ServerX\\admin$\\system32\\",
    quoted: "Tom \"Dubs\" Preston-Werner",
    regex: "<\\i\\c*\\s*>"
  });
  test.done();
};

exports.testMultilineLiteralStrings = function(test) {
  var str = fs.readFileSync(__dirname + "/multiline_literal_strings.toml", 'utf8');
  test.deepEqual(toml.parse(str), {
    regex2: "I [dw]on't need \\d{2} apples",
    lines: "The first newline is\ntrimmed in raw strings.\n   All other whitespace\n   is preserved.\n"
  });
  test.done();
};

exports.testIntegerFormats = function(test) {
  var str = "a = +99\nb = 42\nc = 0\nd = -17\ne = 1_000_001\nf = 1_2_3_4_5   # why u do dis";
  test.deepEqual(toml.parse(str), {
    a: 99,
    b: 42,
    c: 0,
    d: -17,
    e: 1000001,
    f: 12345
  });
  test.done();
};

exports.testFloatFormats = function(test) {
  var str = "a = +1.0\nb = 3.1415\nc = -0.01\n" +
            "d = 5e+22\ne = 1e6\nf = -2E-2\n" +
            "g = 6.626e-34\n" +
            "h = 9_224_617.445_991_228_313\n" +
            "i = 1e1_000";
  test.deepEqual(toml.parse(str), {
    a: 1.0,
    b: 3.1415,
    c: -0.01,
    d: 5e22,
    e: 1e6,
    f: -2e-2,
    g: 6.626e-34,
    h: 9224617.445991228313,
    i: 1e1000
  });
  test.done();
};

exports.testDate = function(test) {
  var date = new Date("1979-05-27T07:32:00Z");
  test.deepEqual(toml.parse("a = 1979-05-27T07:32:00Z"), {
    a: date
  });
  test.done();
};

exports.testDateWithOffset = function(test) {
  var date1 = new Date("1979-05-27T07:32:00-07:00"),
      date2 = new Date("1979-05-27T07:32:00+02:00");
  test.deepEqual(toml.parse("a = 1979-05-27T07:32:00-07:00\nb = 1979-05-27T07:32:00+02:00"), {
    a: date1,
    b: date2
  });
  test.done();
};

exports.testDateWithSecondFraction = function(test) {
  var date = new Date("1979-05-27T00:32:00.999999-07:00");
  test.deepEqual(toml.parse("a = 1979-05-27T00:32:00.999999-07:00"), {
    a: date
  });
  test.done();
};

exports.testInlineTables = function(test) {
  var str = fs.readFileSync(__dirname + "/inline_tables.toml", 'utf8'),
      parsed = toml.parse(str);
  test.deepEqual(parsed, {
    name: {
      first: "Tom",
      last: "Preston-Werner"
    },
    point: {
      x: 1,
      y: 2
    },
    nested: {
      x: {
        a: {
          b: 3
        }
      }
    },
    points: [
      { x: 1, y: 2, z: 3 },
      { x: 7, y: 8, z: 9 },
      { x: 2, y: 4, z: 8 }
    ],
    arrays: [
      { x: [1, 2, 3], y: [4, 5, 6] },
      { x: [7, 8, 9], y: [0, 1, 2] }
    ]
  });
  test.done();
};

exports.testErrorOnBadUnicode = function(test) {
  var str = "str = \"My name is Jos\\uD800\"";
  test.throws(function() {
    toml.parse(str);
  });
  test.done();
};

exports.testErrorOnDotAtStartOfKey = function(test) {
  test.throws(function() {
    var str = "[.a]\nb = 1";
    toml.parse(str);
  });
  test.done()
};

exports.testErrorOnDotAtEndOfKey = function(test) {
  test.throws(function() {
    var str = "[.a]\nb = 1";
    toml.parse(str);
  });
  test.done()
};

exports.testErrorOnTableOverride = function(test) {
  test.throws(function() {
    var str = "[a]\nb = 1\n\n[a]\nc = 2";
    toml.parse(str);
  });
  test.done()
};

exports.testErrorOnKeyOverride = function(test) {
  test.throws(function() {
    var str = "[a]\nb = 1\n[a.b]\nc = 2";
    toml.parse(str);
  });
  test.done()
};

exports.testErrorOnKeyOverrideWithArrayTable = function(test) {
  test.throws(function() {
    var str = "[a]\nb = 1\n[[a]]\nc = 2";
    toml.parse(str);
  });
  test.done()
};

exports.testErrorOnKeyReplace = function(test) {
  test.throws(function() {
    var str = "[a]\nb = 1\nb = 2";
    toml.parse(str);
  });
  test.done()
};

exports.testErrorOnArrayMismatch = function(test) {
  test.throws(function() {
    var str = 'data = [1, 2, "test"]'
    toml.parse(str);
  });
  test.done();
};

exports.textErrorOnBadInputs = function(test) {
  var count = 0;
  for (i in badInputs) {
    (function(num) {
      test.throws(function() {
        toml.parse(badInputs[num]);
      });
    })(i);
  }
  test.done();
};

exports.testErrorsHaveCorrectLineAndColumn = function(test) {
  var str = "[a]\nb = 1\n [a.b]\nc = 2";
  try { toml.parse(str); }
  catch (e) {
    test.equal(e.line, 3);
    test.equal(e.column, 2);
    test.done();
  }
};

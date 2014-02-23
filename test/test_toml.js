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

'use strict';

const Benchmark = require('benchmark');
const deepEqual = require('deep-equal');
const fs = require('fs');
const glob = require('glob');
const upath = require('upath');

const ini = require('ini');
const jsYaml = require('js-yaml');
const tomlJ = require('toml-j0.4');
const tomlNode = require('../index.js');
const yaml = require('yaml');
const yamljs = require('yamljs');

const parsers = [
  {
    name: 'ini',
    format: 'ini',
    parse: (str) => ini.parse(str),
  },
  {
    name: 'js-yaml',
    format: 'yaml',
    parse: (str) => jsYaml.safeLoad(str),
  },
  // js-yaml can reliably parse json. the others, not so much.
  {
    name: 'js-yaml(json)',
    format: 'json',
    parse: (str) => jsYaml.safeLoad(str),
  },
  {
    name: 'json',
    format: 'json',
    parse: (str) => JSON.parse(str),
  },
  {
    name: 'toml-j0.4',
    format: 'toml',
    parse: (str) => tomlJ.parse(str),
  },
  {
    name: 'toml-node',
    format: 'toml',
    parse: (str) => tomlNode.parse(str),
  },
  {
    name: 'yaml',
    format: 'yaml',
    parse: (str) => yaml.eval(str),
  },
  {
    name: 'yamljs',
    format: 'yaml',
    parse: (str) => yamljs.parse(str),
  },
];

const formats = new Set(parsers.map((p) => p.format));

const longestName = parsers.reduce((a, p) => Math.max(a, p.name.length), 0);

function benchAll() {
  for (let fname of glob.sync(upath.join(__dirname, '*.json'))) {
    benchOne(fname);
  }
};

function benchOne(name) {
  let suite = new Benchmark.Suite();
  let example = loadExample(name);
  for (let parser of parsers) {
    let benchName = `parse ${example.name} with ` + parser.name.padEnd(longestName, ' ');

    let input = example[parser.format];
    if (input == null) {
      console.log(`${benchName} skipped`);
      continue;
    }

    // Verify the parser works correctly.
    let expected = JSON.parse(example.json);
    let actual;
    try {
      actual = parser.parse(input);
    } catch (e) {
      actual = String(e);
    }
    if (!deepEqual(actual, expected)) {
      console.log(`${benchName} broken`);
      console.error(' actual:\n', actual);
      continue;
    }

    suite.add(benchName, () => parser.parse(input));
  }

  suite.on('cycle', (event) => console.log(String(event.target)));
  suite.run();
}

function loadExample(name) {
  let path = upath.parse(name);
  let example = {
    name: path.name,
  };
  for (let format of formats) {
    let f = upath.join(path.dir, path.name + '.' + format);
    if (fs.existsSync(f)) {
      example[format] = fs.readFileSync(f, 'utf-8');
    }
  }
  return example;
}

exports.benchOne = benchOne;
exports.benchAll = benchAll;

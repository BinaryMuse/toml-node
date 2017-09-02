'usr strict';

const bench = require('./bench');

let args = [];
let onlyParsers = new Set();

// process any parsers= arguments
for (let arg of process.argv.slice(2)) {
  let m = /parsers?=(.*)/.exec(arg);
  if (m) {
    for (let p of m[1].split(/[,\s]+/)) {
      onlyParsers.add(p);
    }
  } else {
    args.push(m);
  }
}

if (args.length) {
  for (let arg of args) {
    bench.benchOne(arg, onlyParsers);
  }
} else {
  bench.benchAll(onlyParsers);
}

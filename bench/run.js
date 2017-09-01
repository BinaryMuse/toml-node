'usr strict';

const bench = require('./bench');

let args = process.argv.slice(2);
if (args.length) {
  for (let arg of args) {
    bench.benchOne(arg);
  }
} else {
  bench.benchAll();
}

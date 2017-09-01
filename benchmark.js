var toml = require('./index');
var fs = require('fs');
var data = fs.readFileSync('./test/example.toml', 'utf8');

const NS_PER_SEC = 1e9;
const toMs = function([a, b]) {
  const total = a * NS_PER_SEC + b
  return total / 1000 / 1000
}

const times = {
  parse: 0,
  compile: 0,
}

const pending = {}

function enter(rule) {
  pending[rule] = pending[rule] || [];
  pending[rule].push(process.hrtime());
}

function fail(rule) {
  const last = pending[rule].pop();
  const delta = process.hrtime(last);
  const key = `${rule}.fail`
  times[key] = times[key] || {count: 0, time: 0};
  times[key].time += toMs(delta)
  times[key].count++
}

function match(rule) {
  const last = pending[rule].pop();
  const delta = process.hrtime(last);
  const key = `${rule}.match`
  times[key] = times[key] || {count: 0, time: 0};
  times[key].time += toMs(delta)
  times[key].count++
}

const tracer = {
  trace: function(evt) {
    switch(evt.type) {
      case 'rule.enter':
        enter(evt.rule);
        break;
      case 'rule.fail':
        fail(evt.rule);
        break;
      case 'rule.match':
        match(evt.rule);
        break;
    }
  }
}

var ITERATIONS = 1000;
var start = new Date();
for(var i = 0; i < ITERATIONS; i++) {
  const info = toml._trace(data, tracer);
  times.parse += info.parseTime
  times.compile += info.compileTime
}
var end = new Date();
console.log("%s iterations in %sms", ITERATIONS, end - start);
console.log(`Time spent parsing:   ${times.parse}`)
console.log(`Time spent compiling: ${times.compile}`)
console.log('\npeg.js trace data:\n')
console.log('rule,type,count,total_time,avg_time')
Object.keys(times).forEach(key => {
  if (typeof times[key] !== 'object') {
    return;
  }

  const [rule, type] = key.split('.');
  const {time, count} = times[key];
  console.log(`${rule},${type},${count},${time},${time/count}`);
})

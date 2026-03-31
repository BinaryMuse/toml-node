var toml = require('./index');
var fs = require('fs');

var classic = fs.readFileSync('./test/example.toml', 'utf8');
var comprehensive = [
  '# TOML v1.0.0 benchmark payload',
  'title = "Benchmark"',
  '',
  '[owner]',
  'name = "Test User"',
  'bio = """Multi-line \\',
  '  string with continuation"""',
  "regex = '<\\i\\c*\\s*>'",
  'dob = 1979-05-27T07:32:00Z',
  'updated = 1979-05-27 07:32:00-07:00',
  '',
  '[database]',
  'server = "192.168.1.1"',
  'ports = [8001, 8001, 8003]',
  'connection_max = 5_000',
  'max_temp = 87.1',
  'enabled = true',
  'hex = 0xDEADBEEF',
  'oct = 0o755',
  'bin = 0b11010110',
  'pos_inf = inf',
  'neg_inf = -inf',
  'not_a_number = nan',
  '',
  '[servers.alpha]',
  'ip = "10.0.0.1"',
  'dc = "eqdc10"',
  '',
  '[servers.beta]',
  'ip = "10.0.0.2"',
  'dc = "eqdc10"',
  '',
  '[clients]',
  'data = [["gamma", "delta"], [1, 2]]',
  'mixed = [1, "two", 3.0, true]',
  'hosts = ["alpha", "omega"]',
  '',
  '[inline]',
  'point = {x = 1, y = 2}',
  'name = {first = "Tom", last = "Preston-Werner"}',
  'animal = {type.name = "pug"}',
  '',
  'fruit.apple.color = "red"',
  'fruit.apple.taste.sweet = true',
  '',
  '[dates]',
  'odt1 = 1979-05-27T07:32:00Z',
  'odt2 = 1979-05-27T00:32:00-07:00',
  'ldt1 = 1979-05-27T07:32:00',
  'ld1 = 1979-05-27',
  'lt1 = 07:32:00',
  '',
  '[[products]]',
  'name = "Hammer"',
  'sku = 738594937',
  '',
  '[[products]]',
  '',
  '[[products]]',
  'name = "Nail"',
  'sku = 284758393',
  'color = "gray"',
  ''
].join('\n');

function bench(name, input, iterations) {
  // Warmup
  for (var i = 0; i < 100; i++) toml.parse(input);

  var start = process.hrtime.bigint();
  for (var i = 0; i < iterations; i++) {
    toml.parse(input);
  }
  var elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  var opsPerSec = Math.round(iterations / (elapsed / 1000));
  console.log('  %s: %s iterations in %sms (%s ops/sec)',
    name, iterations, elapsed.toFixed(0), opsPerSec.toLocaleString());
}

console.log('toml-node benchmark');
console.log('-------------------');
bench('classic (v0.4.0 example)', classic, 5000);
bench('comprehensive (v1.0.0 features)', comprehensive, 5000);

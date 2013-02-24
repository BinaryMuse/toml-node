var toml = require('../');
var fs = require('fs');

var str = fs.readFileSync(__dirname + '/example.toml', 'utf-8');
var result = toml.parse(str);

console.log("Object result of toml.parse:");
console.dir(result);

console.log("\nOutput of result.owner.bio:");
console.log(result.owner.bio);

console.log("\nInspecting clients.data:");
console.dir(result.clients.data);

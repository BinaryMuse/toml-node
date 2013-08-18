var app = angular.module('toml', []);

app.value('tomlDemoString', [

'# This is a TOML document. Boom.',
'',
'title = "TOML Example"',
'',
'[owner]',
'name = "Tom Preston-Werner"',
'organization = "GitHub"',
'bio = "GitHub Cofounder & CEO\\n\\tLikes \\"tater tots\\" and beer and backslashes: \\\\"',
'dob = 1979-05-27T07:32:00Z # First class dates? Why not?',
'',
'[database]',
'server = "192.168.1.1"',
'ports = [ 8001, 8001, 8003 ]',
'connection_max = 5000',
'connection_min = -2 # Don\'t ask me how',
'max_temp = 87.1 # It\'s a float',
'min_temp = -17.76',
'enabled = true',
'',
'[servers]',
'',
'  # You can indent as you please. Tabs or spaces. TOML don\'t care.',
'  [servers.alpha]',
'  ip = "10.0.0.1"',
'  dc = "eqdc10"',
'',
'  [servers.beta]',
'  ip = "10.0.0.2"',
'  dc = "eqdc10"',
'',
'[clients]',
'data = [ ["gamma", "delta"], [1, 2] ] # just an update to make sure parsers support it',

].join("\n"));

app.controller('DemoController', function($scope, tomlDemoString) {
  $scope.original = "" + tomlDemoString;

  $scope.reparse = function() {
    try {
      $scope.parsed = JSON.stringify(toml.parse($scope.original), null, "  ");
    } catch (exc) {
      $scope.parsed = "Syntax error at line " + exc.line + ", column " + exc.column;
    }
  };

  $scope.countNewlines = function() {
    var origCount  = $scope.original.split("\n").length + 2;
    var parseCount = $scope.parsed.split("\n").length + 2;
    return Math.max(origCount, parseCount);
  };

  $scope.reparse();
});


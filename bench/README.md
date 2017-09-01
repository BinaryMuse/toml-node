Multi-parser benchmarks
=======================

`node run.js` will run all benchmarks.

`node run.js file.json ...` will run just the named benchmarks.

Each benchmark is a collection of files that are equivalent
representations of the same data in different formats:

- `{name}.json` is the expected result.
- `{name}.ini` is the data in ini format.
- `{name}.toml` is the data in toml format.
- `{name}.yaml` is the data in yaml format.

Only the `.json` file is required. A parser will only be
benchmarked if there's an appropriate input file for it.

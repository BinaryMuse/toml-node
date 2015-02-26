2.2.0 - Feb 26 2015
===================

* Support TOML spec v0.4.0

2.1.0 - Jan 7 2015
==================

* Support TOML spec v0.3.1

2.0.6 - May 23 2014
===================

### Bug Fixes

* Fix support for empty arrays with newlines ([#13](https://github.com/BinaryMuse/toml-node/issues/13))

2.0.5 - May 5 2014
==================

### Bug Fixes

* Fix loop iteration leak, by [sebmck](https://github.com/sebmck) ([#12](https://github.com/BinaryMuse/toml-node/pull/12))

### Development

* Tests now run JSHint on `lib/compiler.js`

2.0.4 - Mar 9 2014
==================

### Bug Fixes

* Fix failure on duplicate table name inside table array ([#11](https://github.com/BinaryMuse/toml-node/issues/11))

2.0.2 - Feb 23 2014
===================

### Bug Fixes

* Fix absence of errors when table path starts or ends with period

2.0.1 - Feb 23 2014
===================

### Bug Fixes

* Fix incorrect messaging in array type errors
* Fix missing error when overwriting key with table array

2.0.0 - Feb 23 2014
===================

### Features

* Add support for [version 0.2 of the TOML spec](https://github.com/mojombo/toml/blob/master/versions/toml-v0.2.0.md) ([#9](https://github.com/BinaryMuse/toml-node/issues/9))

### Internals

* Upgrade to PEG.js v0.8 and rewrite compiler; parser is now considerably faster (from ~7000ms to ~1000ms to parse `example.toml` 1000 times on Node.js v0.10)

1.0.4 - Aug 17 2013
===================

### Bug Fixes

* Fix support for empty arrays

1.0.3 - Aug 17 2013
===================

### Bug Fixes

* Fix typo in array type error message
* Fix single-element arrays with no trailing commas

1.0.2 - Aug 17 2013
===================

### Bug Fixes

* Fix errors on lines that contain only whitespace ([#7](https://github.com/BinaryMuse/toml-node/issues/7))

1.0.1 - Aug 17 2013
===================

### Internals

* Remove old code remaining from the remove streaming API

1.0.0 - Aug 17 2013
===================

Initial stable release

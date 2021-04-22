# Contributing

* Please submit issues and PRs through the [GitHub tracker][].
* Make sure you have `tsc`, `tslint`, `gulp`, `mocha`, and `docker` installed globally.
* Run `gulp init` to install dependencies in every subdirectory, and 
`docker-compose up -d; gulp test; docker-compose down` to run the test suites. Docker
is useful to run the databases and other external services that are required by the
modules that we are patching. If you don't want to install docker, you must install
PostgreSQL (and possibly more to come) and run a server on port 16200 before running
the tests. The tests do not create or mutate any information, they only send simple
queries such as `SELECT NOW();`.
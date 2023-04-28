# Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

# How to contribute to the Application Insights Node Diagnostic Channel

1. Fork this repo
2. Clone your fork locally (`git clone https://github.com/<youruser>/node-diagnostic-channel
3. Open a terminal and move into your local copy (`cd node-diagnostic-channel`)
* Make sure you have `tsc`, `grunt`, `mocha`, and `docker` installed globally.
4. Run `grunt init` to install dependencies in every subdirectory, and 
`docker-compose up -d; nmp run test; docker-compose down` to run the test suites. Docker
is useful to run the databases and other external services that are required by the
modules that we are patching. If you don't want to install docker, you must install
PostgreSQL (and possibly more to come) and run a server on port 16200 before running
the tests. The tests do not create or mutate any information, they only send simple
queries such as `SELECT NOW();`.
---
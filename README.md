# diagnostic-channel

## What?

**diagnostic-channel** provides a shared channel for handling instrumentation
and diagnostic messages in Node.js apps. Instrumentation patchers and module
authors can publish messages to this channel by calling `channel.publish(...)`,
and APM providers and other tools can subscribe to those messages by calling
`channel.subscribe(...)`. Subscribers can transform the original generic message
as needed in their handlers and relay the message on to storage and monitoring
systems.

**diagnostic-channel-publishers** provides a set of patches for common Node.js
modules to publish instrumentation data to the diagnostic-channel channel.  

## Why?

By providing a shared message bus, diagnostic-channel will allow re-use of the
same instrumentation patches by many tools and APM providers. We believe that
sharing a common bus and patches will enable the Node.js community to
collaborate more with module authors and tool providers to improve and increase
collected data. Ultimately this will help us all achieve our true goal of
serving more helpful insights to Node.js developers.

Beyond `console.log` and its weaknesses, module authors and even core
contributors have had few dependable ways to share traces, metrics, and other
data collected by their systems and modules. The Node.js [Diagnostics WG][] has
several efforts in flight to address this, including [trace_events][] support,
Inspector, and [async_hooks][]. This diagnostic-channel project is another
part of these efforts.

[Diagnostics WG]: https://github.com/nodejs/diagnostics
[trace_events]: https://github.com/nodejs/node/pull/11207#issuecomment-295331471
[async_hooks]: https://github.com/nodejs/node/pull/11883


# How to Use

If you're a module author you can produce output directly from your own
modules for the shared channel. If you're patching someone else's module you'll
need to implement a publisher/patcher to patch in your instrumentation.

In either case, to get started:

1. Add diagnostic-channel to your module: `npm install --save
   diagnostic-channel`.
2. Import it within your module: `const channel =
   require('diagnostic-channel').channel`.
3. Use [APIs][] such as `channel.subscribe(...)` and `channel.publish(...)`
   to publish or handle diagnostic messages.

[APIs]: ./src/diagnostic-channel/README.md

To use the set of publisher patches from this repo:
`require('diagnostic-channel-publishers').enable()`.

If you're creating a publisher/patcher for another module, start from one of the
included publishers in [src/diagnostic-channel-publishers/src](https://github.com/Microsoft/node-diagnostic-channel/tree/master/src/diagnostic-channel-publishers/src)
and see [Contributing](#Contributing) below

# License

MIT. See [LICENSE](./LICENSE).

## Contributing
For details on contributing to this repository, see the [contributing guide](https://github.com/microsoft/node-diagnostic-channel/master/CONTRIBUTING.md).

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit
https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repositories using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
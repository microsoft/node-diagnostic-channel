# diagnostic-channel

This package provides a channel to connect diagnostic event publishers and subscribers. It includes a way to preserve context for the published event too. What that context is and contains is deliberately left unspecified.

## Usage

### Subscribe to an event:

```js
const channel = require('diagnostic-channel').channel;

channel.subscribe('someEvent', function (event) {
    // do something about the event
});
```

The properties of the `event` object passed to the subscriber handler function
are determined by the publisher.

### Publish an event

```js
var someData = { myField: "myData" };
const channel = require('diagnostic-channel').channel;

channel.publish('someEvent', someData);
```

### Publish an event with context

Preserving context on publication may require some additional effort. A
correlation handler can be added with the `addContextPreservation` method, and
then the `bindToContext` method can be used to set up context using the
provided handler before calling its received function.

```js
channel.addContextPreservation((callback) => {
    return Zone.current.wrap(callback);
});

function doWork(args, callback) {
    // In some context...
    doBatchedAsyncWork(args, channel.bindToContext((result) => {
        channel.publish('someEvent', {result: result});
        callback(result);
    }))
}
```

## API

### subscribe

`channel.subscribe(name: string, callback: (event: any) => void): void`

Register the callback to be called when `publish` is invoked with a matching name. The callback will be given the object that is passed to the `publish` call.

If the callback throws an error, it will be silently ignored. If the callback modifies the event object, any subsequent subscribers will see the modified object, and it may also impact the original code's execution.

### publish

`channel.publish(name: string, event: any): void`

Trigger each subscribed callback for the same named event, passing the `event` object to each.

Subscribers may modify the event object.

### unsubscribe

`channel.unsubscribe(name: string, callback: (event: any) => void): void`

Remove a previously registered callback from the named event. This uses function equality so it must be a reference to the same function, not an equivalent function.

### addContextPreservation

`channel.addContextPreservation(preserver: (callback: Function) => Function)`

Pushes the provided context preservation function onto a 'stack' of functions to preserve context.

The context preservation function `preserver` is expected to capture the current context and return a function that when invoked restores this preserved context and only then calls the provided callback with the originally provided arguments. Before returning, this second function should also restore the previous context.

A simple example preserving the Zone.js context:

```js
channel.addContextPreservation((callback) => {
    return Zone.current.wrap(callback);
});
```

A more general, but somewhat contrived, example, where the 'context' is a global object called `context`:

```js
var context = { value: 1 };

channel.addContextPreservation((callback) => {
    var preservedContext = context;
    return function () {
        var priorContext = context;
        context = preservedContext;
        var result = callback.apply(this, arguments);
        context = priorContext;
        return result;
    }
});
```

### bindToContext

`channel.bindToContext(callback: Function)`

Returns a function which will call the callback after applying each of the registered context preservation functions, and return the result of the callback after unwinding each of the context preservation functions.

For example, when using Zone.js:

```js
channel.addContextPreservation((callback) => Zone.current.wrap(callback));

var z1 = Zone.current.fork({name: 'zone 1'});
var z2 = Zone.current.fork({name: 'zone 2'});

var z1BoundFunc = z1.run(() => channel.bindToContext(() => Zone.current.name));

var result = z2.run(() => z1BoundFunc());
```

Because the function was bound in `zone 1`, `result` will be `zone 1`.

### registerMonkeyPatch

`channel.registerMonkeyPatch(packageName: string, patcher: {versionSpecifier: string, patch: (any, path: string) => any})`;

In order to inject publishing and context preservation behavior into third party libraries, we support monkey patching libraries as they are `require`'d.

Calling this function will register a candidate monkey patcher to be applied when a future `require(packageName)` is called. If the package's version is a semver match for the `versionSpecifier` range, then the original object for that package is passed to the `patch` function, along with the path to the module, and the `patch` function should return a patched version which will end up as the result of the `require`.

For a simple example where we patch a `doSomethingAsync` method of the `foo` module to preserve the current context when invoking a callback:

```js
function patchFunction(originalPackage, packagePath) {
    var originalFooAsync = foo.doSomethingAsync;
    foo.doSomethingAsync = function () {
        var callback = arguments[arguments.length-1];
        if (callback && typeof callback == 'function') {
            arguments[arguments.length-1] = channel.bindToContext(callback);
        }
        return originalFooAsync.apply(this, arguments);
    }
    return originalPackage;
}

var patcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: patchFunction
};

channel.registerMonkeyPatch('foo', patcher);

var foo = require('foo');
// Now foo.doSomethingAsync will be the patched version, assuming that the version of the foo package found by require() falls within the 1.0.0 - 2.0.0 range.
```

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to
agree to a Contributor License Agreement (CLA) declaring that you have the right to,
and actually do, grant us the rights to use your contribution. For details, visit
https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need
to provide a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the
instructions provided by the bot. You will only need to do this once across all repositories using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/)
or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Data Collection

As this SDK is designed to enable applications to perform data collection which is sent to the Microsoft collection endpoints the following is required to identify our privacy statement.

The software may collect information about you and your use of the software and send it to Microsoft. Microsoft may use this information to provide services and improve our products and services. You may turn off the telemetry as described in the repository. There are also some features in the software that may enable you and Microsoft to collect data from users of your applications. If you use these features, you must comply with applicable law, including providing appropriate notices to users of your applications together with a copy of Microsoft’s privacy statement. Our privacy statement is located at https://go.microsoft.com/fwlink/?LinkID=824704. You can learn more about data collection and use in the help documentation and our privacy statement. Your use of the software operates as your consent to these practices.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party’s policies.

## License

[MIT](LICENSE)
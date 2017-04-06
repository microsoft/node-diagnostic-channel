// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";

/* tslint:disable:no-console */

// Need to undo any changes this require makes, so we can test that it makes them.
const originalConsoleDescriptor = Object.getOwnPropertyDescriptor(global, "console");
import {console as consolePatch, IConsoleData} from "../console.pub";
Object.defineProperty(global, "console", originalConsoleDescriptor);

import {channel, IStandardEvent, makePatchingRequire} from "pubsub-channel";

describe("Console", function() {
    const moduleModule = require("module");
    const originalRequire = moduleModule.prototype.require;

    before(() => (channel as any).reset());
    afterEach(() => {
        (channel as any).reset();
        moduleModule.prototype.require = originalRequire;
        Object.defineProperty(global, "console", originalConsoleDescriptor);
    });

    it("should intercept console.log", function() {
        let eventEmitted: IStandardEvent<IConsoleData>;
        channel.subscribe<IConsoleData>("console", (event) => eventEmitted = event);

        moduleModule.prototype.require = makePatchingRequire({console: [consolePatch]});

        console.log("Before mocking");
        assert(!eventEmitted, "Nothing should be hooked up yet");

        const testLogMessage = "After mocking";

        require("console");

        console.log(testLogMessage);
        assert(eventEmitted, "Event not published");
        assert.equal(eventEmitted.data.message.replace("\n", ""), testLogMessage);
        assert(!eventEmitted.data.stderr);
    });

    it("should be safe to console.log within a console subscriber", function() {
        let eventEmitted: IStandardEvent<IConsoleData>;
        channel.subscribe<IConsoleData>("console", (event) => {
            console.log("Logging within subscriber: " + event.data.message);
            eventEmitted = event;
        });

        moduleModule.prototype.require = makePatchingRequire({console: [consolePatch]});

        require("console");

        console.log("Checking for crashes");
        assert(eventEmitted, "Event not published");
    });
});

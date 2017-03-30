import * as assert from 'assert';

// Need to undo any changes this require makes, so we can test that it makes them.
const originalConsoleDescriptor = Object.getOwnPropertyDescriptor(global, 'console');
import {console as consolePatch, ConsoleData} from "../console.pub";
Object.defineProperty(global, 'console', originalConsoleDescriptor);

import {channel, makePatchingRequire, IStandardEvent} from "pubsub-channel";

describe('Console', function () {
    const moduleModule = require('module');
    const originalRequire = moduleModule.prototype.require;

    before(() => (<any>channel).reset());
    afterEach(() => {
        (<any>channel).reset();
        moduleModule.prototype.require = originalRequire;
        Object.defineProperty(global, 'console', originalConsoleDescriptor);
    })

    it('should intercept console.log', function () {    
        let eventEmitted: IStandardEvent<ConsoleData>;
        channel.subscribe<ConsoleData>('console', (event) => eventEmitted = event);

        moduleModule.prototype.require = makePatchingRequire({'console': [consolePatch]});

        console.log("Before mocking");
        assert(!eventEmitted, 'Nothing should be hooked up yet');

        const testLogMessage = "After mocking";

        require('console');

        console.log(testLogMessage);
        assert(eventEmitted, 'Event not published');
        assert.equal(eventEmitted.data.message.replace('\n',''), testLogMessage);
        assert(!eventEmitted.data.stderr);
    });

    it('should be safe to console.log within a console subscriber', function () {
        let eventEmitted: IStandardEvent<ConsoleData>;
        channel.subscribe<ConsoleData>('console', (event) => {
            console.log('Logging within subscriber: ' + event.data.message);
            eventEmitted = event;
        });

        moduleModule.prototype.require = makePatchingRequire({'console': [consolePatch]});

        require('console');

        console.log('Checking for crashes');
        assert(eventEmitted, 'Event not published');
    });
});
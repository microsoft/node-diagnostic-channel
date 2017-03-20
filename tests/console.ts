import {makePatchingRequire} from "../patchRequire";
import * as assert from 'assert';

import {console as consolePatch} from "../console/console.pub";

import {channel} from "../channel";


describe('Console', function () {
    afterEach(() => {
        channel.reset();
    })

    it('should intercept console.log', function () {
        const originalConsoleDescriptor = Object.getOwnPropertyDescriptor(global, 'console');        
        const moduleModule = require('module');
        const originalRequire = moduleModule.prototype.require;
        let eventEmitted;
        channel.subscribe('console', (event) => eventEmitted = event);
        try {
            moduleModule.prototype.require = makePatchingRequire({
                'console': [
                    consolePatch
                ]
            });

            console.log("Before mocking");
            assert(!eventEmitted, 'Nothing should be hooked up yet');

            const testLogMessage = "After mocking";

            require('console');

            console.log(testLogMessage);
            assert(eventEmitted, 'Event not published');
            assert.equal(eventEmitted.data.replace('\n',''), testLogMessage);
            assert(!eventEmitted.stderr);

        } finally {
            Object.defineProperty(global, 'console', originalConsoleDescriptor);
            moduleModule.prototype.require = originalRequire;
        }
    })
});
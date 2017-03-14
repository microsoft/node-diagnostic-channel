import {makePatchingRequire} from "../patchRequire";
import * as assert from 'assert';

import * as ApplicationInsights from "applicationinsights";

import {console as consolePatch} from "../console/console";


describe('Console', function () {
    it('should intercept console.log', function () {
        const originalConsoleDescriptor = Object.getOwnPropertyDescriptor(global, 'console');        
        const moduleModule = require('module');
        const originalRequire = moduleModule.prototype.require;
        const originalAIClient = ApplicationInsights.client;
        try {
            moduleModule.prototype.require = makePatchingRequire({
                'console': [
                    consolePatch
                ]
            });

            ApplicationInsights.client = {
                trackTrace: function () {
                    throw new Error('AI should not be tracking this yet');
                }
            };
            console.log("Before mocking");

            let testLogMessage = "After mocking";
            let mockInvoked = false;
            ApplicationInsights.client = {
                trackTrace: function (data) {
                    mockInvoked = true;
                    assert.equal(data.replace('\n',''), testLogMessage);
                }
            };
            require('console');

            console.log(testLogMessage);
            assert(mockInvoked, 'AI tracking function was not invoked.');
        } finally {
            Object.defineProperty(global, 'console', originalConsoleDescriptor);
            moduleModule.prototype.require = originalRequire;
            ApplicationInsights.client = originalAIClient;
        }
    })
});
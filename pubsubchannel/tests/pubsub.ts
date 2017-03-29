// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel} from '../channel';

import * as assert from 'assert';

describe('pub/sub', function () {
    afterEach(() => {
        channel.reset();
    });

    it('should invoke subscribers', function () {
        const testData = {test: true};
        let invokedData;
        channel.subscribe("test", (data) => {
            invokedData = data;
        });

        channel.publish("test", testData);
        assert.strictEqual(invokedData, testData, 'Subscriber called with incorrect values');
    });

    it('should do nothing if there are no subscribers', function () {
        channel.publish("ignoredEvent", {});
    });

    it('should invoke subscribers in the right order', function () {
        const invocations = [];
        channel.subscribe("test", () => {
            invocations.push(1);
        });
        channel.subscribe("test", () => {
            invocations.push(2);
        });

        channel.publish("test", {});

        assert.equal(invocations.length, 2);
        assert.equal(invocations[0], 1);
        assert.equal(invocations[1], 2);
    });

    it('should not propagate errors to the publishing method', function () {
        let invoked = false;
        channel.subscribe("test", () => {
            invoked = true;
            throw new Error("Errors in subscribers should not propagate to the publisher");
        });

        channel.publish("test", {});

        assert(invoked, "Subscriber not called");
    });

    it('should invoke subscribers in the same context as the publish', function () {
        const c1 = {name: '1'};
        const c2 = {name: '2'};
        let context = {name:'root'};

        let invocations = [];
        const subscribeFunction = () => {
            invocations.push(context);
        };

        channel.subscribe('test', subscribeFunction);

        context = c1;
        channel.publish('test', {});
        context = c2;
        channel.publish('test', {});


        assert.equal(invocations.length, 2);
        assert.equal(invocations[0], c1);
        assert.equal(invocations[1], c2);
    });

    it('should preserve contexts when wrapping function is used', function () {
        const c1 = {name: '1'};
        const c2 = {name: '2'};
        const croot = {name: 'root'};
        let context = croot;

        channel.addContextPreservation((cb) => {
            let originalContext = context;
            return function () {
                const oldContext = context;
                context = originalContext;
                const ret = cb.apply(this, arguments);
                context = oldContext;
                return ret;
            }
        });

        let invocations = [];
        const subscribeFunction = () => {
            invocations.push(context);
        };

        channel.subscribe('test', subscribeFunction);

        const publishFunc = () => {
            channel.publish('test', {});
            return true;
        };
        const rootBound = channel.bindToContext(publishFunc);
        context = c1;
        const c1Bound = channel.bindToContext(publishFunc);

        context = c2;
        assert(rootBound(), "Bound function did not return a value");
        assert(c1Bound());

        assert.equal(invocations.length, 2);
        assert.equal(invocations[0], croot);
        assert.equal(invocations[1], c1);
    });

    it('should report no need for publishing with no subscribers', function () {
        assert(!channel.shouldPublish("test"));
    });

    it('should report there is a need for publishing exactly when a subscriber has a filter returning true', function () {
        let filterRetVal = true;
        let subscriberCalled = false;
        channel.subscribe("test", function () { subscriberCalled = true; }, () => filterRetVal);

        assert(channel.shouldPublish("test"), "Filter returned true but shouldPublish was false");
        assert(!subscriberCalled);

        filterRetVal = false;
        assert(!channel.shouldPublish("test"), "Filter returned false but shouldPublish was true");
    });

    it ('should report a need for publishing if at least one subscriber reports true', function () {
        let filterRetVals = [false, false, true, false, false];
        const mkFilter = (index) => () => filterRetVals[index];
        for(let i = 0; i < filterRetVals.length; ++i) {
            channel.subscribe("test", function () {}, mkFilter(i));
        }

        assert.equal(channel.shouldPublish("test"), filterRetVals.some((v) => v));
        filterRetVals[3] = false;
        assert.equal(channel.shouldPublish("test"), filterRetVals.some((v) => v));
        filterRetVals[0] = true;
        assert.equal(channel.shouldPublish("test"), filterRetVals.some((v) => v));
    });

    it('should unsubscribe the correct listener', function () {
        let calls = [];
        const listener1 = function () {
            calls.push(1);
        };
        const listener2 = function () {
            calls.push(2);
        };
        channel.subscribe('test', listener1);
        channel.subscribe('test', listener2);
        
        assert(channel.unsubscribe('test', listener1), 'subscriber not unsubscribed');

        channel.publish('test', {});

        assert.equal(calls.length, 1, 'Wrong number of listeners invoked');
        assert.equal(calls[0], 2, 'Wrong listener invoked');
    });

    it('should unsubscribe the correct listener when filters are involved', function () {
        let calls = [];
        const listener1 = function () {
            calls.push(1);
        };
        const listener2 = function () {
            calls.push(2);
        };
        const filter1 = function () {
            return true;
        };
        const filter2 = function () {
            return true;
        };

        channel.subscribe('test', listener1, filter1);
        channel.subscribe('test', listener2, filter1);
        channel.subscribe('test', listener1, filter2);
        channel.subscribe('test', listener2, filter2);

        assert(channel.unsubscribe('test', listener1, filter1), 'subscriber 1 not unsubscribed');
        assert(channel.unsubscribe('test', listener2, filter2), 'subscriber 2 not unsubscribed');

        channel.publish('test', {});

        assert.equal(calls.length, 2, 'Wrong number of listeners invoked');
        assert.deepEqual(calls, [2,1], 'Wrong listeners removed');
    });
});
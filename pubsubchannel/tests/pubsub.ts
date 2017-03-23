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
});
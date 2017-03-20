
import {channel} from '../channel';

import * as assert from 'assert';
import "zone.js";

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

    it('should invoke subscribers in the same zone as the publish', function () {
        const zone1 = Zone.current.fork({name: 'z1'});
        const zone2 = Zone.current.fork({name: 'z2'});

        let invocations = [];
        const subscribeFunction = () => {
            invocations.push(Zone.current.name);
        };

        zone1.run(() => channel.subscribe('test', subscribeFunction));
        zone2.run(() => channel.publish('test', {}));
        zone1.run(() => channel.publish('test', {}));

        assert.equal(invocations.length, 2);
        assert.equal(invocations[0], zone2.name);
        assert.equal(invocations[1], zone1.name);

    })
});
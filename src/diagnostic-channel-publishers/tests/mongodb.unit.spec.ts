// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import {channel, IStandardEvent} from "diagnostic-channel";
import {IMongoData} from "../src/mongodb.pub";

describe("mongodb (unit)", function() {
    it("should expose correct interface", function() {
        const events: Array<IStandardEvent<IMongoData>> = [];
        channel.subscribe<IMongoData>("mongodb", (event) => events.push(event));
        
        // Simulate a mongodb event
        const mockData: IMongoData = {
            startedData: {
                databaseName: "testdb",
                command: { find: "users" },
                time: new Date()
            },
            event: {
                duration: 20,
                reply: { ok: 1 }
            },
            succeeded: true
        };
        
        channel.publish("mongodb", mockData);
        
        assert.equal(events.length, 1);
        assert.equal(events[0].data.startedData.databaseName, "testdb");
        assert.equal(events[0].data.event.duration, 20);
        assert.equal(events[0].data.succeeded, true);
    });
});
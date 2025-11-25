// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import {channel, IStandardEvent} from "diagnostic-channel";
import {ITediousData} from "../src/tedious.pub";

describe("tedious (unit)", function() {
    it("should expose correct interface", function() {
        const events: Array<IStandardEvent<ITediousData>> = [];
        channel.subscribe<ITediousData>("tedious", (event) => events.push(event));
        
        // Simulate a tedious event
        const mockData: ITediousData = {
            query: { text: "SELECT * FROM users" },
            database: { host: "localhost", port: "1433" },
            result: { rowCount: 3, rows: [] },
            duration: 25
        };
        
        channel.publish("tedious", mockData);
        
        assert.equal(events.length, 1);
        assert.equal(events[0].data.query.text, "SELECT * FROM users");
        assert.equal(events[0].data.duration, 25);
    });
});
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import {channel, IStandardEvent} from "diagnostic-channel";
import {IPostgresData} from "../src/pg.pub";

describe("pg (unit)", function() {
    it("should expose correct interface", function() {
        const events: Array<IStandardEvent<IPostgresData>> = [];
        channel.subscribe<IPostgresData>("postgres", (event) => events.push(event));
        
        // Simulate a postgres event
        const mockData: IPostgresData = {
            query: { text: "SELECT * FROM users" },
            database: { host: "localhost", port: "5432" },
            result: { rowCount: 1, command: "SELECT" },
            duration: 15,
            time: new Date()
        };
        
        channel.publish("postgres", mockData);
        
        assert.equal(events.length, 1);
        assert.equal(events[0].data.query.text, "SELECT * FROM users");
        assert.equal(events[0].data.duration, 15);
    });
});
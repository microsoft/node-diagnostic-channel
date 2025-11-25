// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import {channel, IStandardEvent} from "diagnostic-channel";
import {IMysqlData} from "../src/mysql.pub";

describe("mysql (unit)", function() {
    it("should expose correct interface", function() {
        const events: Array<IStandardEvent<IMysqlData>> = [];
        channel.subscribe<IMysqlData>("mysql", (event) => events.push(event));
        
        // Simulate a mysql event
        const mockData: IMysqlData = {
            query: { sql: "SELECT * FROM users" },
            callbackArgs: {} as any,
            err: null,
            duration: 10,
            time: new Date()
        };
        
        channel.publish("mysql", mockData);
        
        assert.equal(events.length, 1);
        assert.equal(events[0].data.query.sql, "SELECT * FROM users");
        assert.equal(events[0].data.duration, 10);
    });
});
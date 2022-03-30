// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import { channel, IStandardEvent } from "diagnostic-channel";
import * as tediousTypes from "tedious";
import "zone.js";
import { enable as enableTedious, ITediousData } from "../src/tedious.pub";

const config = {
    server: "localhost",
    options: {
        port: 14330,
        database: "test_db"
    },
    authentication: {
        type: "default",
        options: {
            userName: "root",
            password: "root"
        }
    }
};

describe("tedious@6.x", () => {
    let tedious: typeof tediousTypes;
    let actual: ITediousData = null;
    const listener = (event: IStandardEvent<ITediousData>) => {
        actual = event.data;
    };
    let connection: tediousTypes.Connection;

    before((done) => {
        enableTedious();
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));
        tedious = require("tedious");
        connection = new tedious.Connection(config);
        connection.on("connect", (err) => {
            done(err);
        });
    });
    beforeEach(() => {
        channel.subscribe<ITediousData>("tedious", listener);
    });

    afterEach(() => {
        actual = null;
    });

    it("should intercept execSql", (done) => {
        const expectation: ITediousData = {
            query: {
                text: "select 42, 'hello world'"
            },
            database: {
                host: "localhost",
                port: "14330"
            },
            duration: null, // Duration is not checked by tests
            error: null,
            result: {
                rowCount: 1,
                rows: []
            }
        };
        const child = Zone.current.fork({name: "child"});
        const handler = (err, rowCount) => {
            assert.ok(actual.duration > 0);
            assert.equal(err, null);
            assert.deepEqual(Zone.current, child);
            assert.deepEqual(actual, { ...expectation, duration: actual.duration });
            done();
        };
        const request = new tedious.Request("select 42, 'hello world'", handler);
        child.run(() => {
            connection.execSql(request);
        });
    });
});

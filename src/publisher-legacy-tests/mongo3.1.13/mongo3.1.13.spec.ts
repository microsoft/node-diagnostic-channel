// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IStandardEvent} from "diagnostic-channel";

import {enable as enableCore} from "../../diagnostic-channel-publishers/src/mongodb-core.pub";
import {enable as enableMongo, IMongoData} from "../../diagnostic-channel-publishers/src/mongodb.pub";

import "zone.js";

import * as assert from "assert";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

enum Mode {
    REPLAY,
    RECORD,
}

/* tslint:disable-next-line:prefer-const */
let mode: Mode = Mode.REPLAY;

describe("mongodb@3.1.13", function() {
    before(() => {
        enableCore();
        enableMongo();
    });

    it("should fire events when we communicate with a collection, and preserve context", function(done) {
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));

        const events: Array<IStandardEvent<IMongoData>> = [];
        channel.subscribe<IMongoData>("mongodb", function(event) {
            events.push(event);
        });

        const mongodb = require("mongodb");

        const z1 = Zone.current.fork({name: "1"});
        z1.run(() =>
        mongodb.MongoClient.connect("mongodb://localhost:27017", { useNewUrlParser: true }, function(err, client) {
            if (err) {
                done(err);
            }

            const collection = client.db("testdb").collection("documents");

            if (Zone.current !== z1) {
                return done(new Error("Context not preserved in connect"));
            }

            const z2 = Zone.current.fork({name: "2"});
            z2.run(() =>
            collection.insertMany([
                {a: 1}, {a: 2}, {a: 3},
            ], function(err2, result) {
                if (err2) {
                    done(err);
                    return;
                }
                if (result.result.n !== 3) {
                    done(new Error("Did not insert 3 elements"));
                    return;
                }

                if (Zone.current !== z2) {
                    done(new Error("Context not preserved in insert callback"));
                    return;
                }

                const z3 = Zone.current.fork({name: "3"});
                z3.run(() =>
                collection.deleteOne({a: 3}).then((result2) => {
                    if (Zone.current !== z3) {
                        throw new Error("Context not preserved in delete promise");
                    }

                    if (result2.deletedCount !== 1) {
                        done(new Error("Did not delete one element"));
                        return;
                    }

                    let skipCounter = 0; // skip reading of endSessions command (added in mongodb server 3.6)
                    // https://docs.mongodb.com/manual/reference/command/endSessions/
                    assert.equal(events.length, 3);
                    assert.equal(events[0 + skipCounter].data.startedData.command.insert, "documents");
                    assert.equal(events[0 + skipCounter].data.event.reply.n, 3);
                    assert.equal(events[0 + skipCounter].data.succeeded, true);
                    if (events[1 + skipCounter].data.event.commandName === "endSessions") {
                        skipCounter += 1;
                    }
                    assert.equal(events[1 + skipCounter].data.startedData.command.delete, "documents");
                    assert.equal(events[1 + skipCounter].data.event.reply.n, 1);
                    assert.equal(events[1 + skipCounter].data.succeeded, true);
                }).then(done, done));
            }));
        }));
    });
});

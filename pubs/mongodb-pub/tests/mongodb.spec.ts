// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IStandardEvent} from "pubsub-channel";

import "../mongodb-core.pub";
import "../mongodb.pub";
import {mongoCommunication, mongodbcoreConnectionRecordPatchFunction} from "./util/mongodbcore-mock-record";
import {makeMongodbcoreConnectionReplayPatchFunction} from "./util/mongodbcore-mock-replay";

import {IMongoData} from "../mongodb.pub";

import "zone.js";

import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

enum Mode {
    REPLAY,
    RECORD,
}

/* tslint:disable-next-line:prefer-const */
let mode: Mode = Mode.REPLAY;

describe("mongodb", function() {

    it("should fire events when we communicate with a collection, and preserve context", function(done) {
        const traceName = "mongodb.trace.json";
        const tracePath = path.join(__dirname, "util", traceName);
        // Note:
        // We patch the underlying connection to record/replay a trace stored in util/mongodb.trace.json
        // This lets us validate the behavior of our mock as long as the mongo commands below are left unchanged,
        // or the trace is updated with a newly recorded version.
        if (mode === Mode.REPLAY) {
            const trace = require(tracePath);
            channel.registerMonkeyPatch("mongodb-core", {versionSpecifier: "*", patch: makeMongodbcoreConnectionReplayPatchFunction(trace)});
        } else {
            assert.equal(mode, Mode.RECORD);
            channel.registerMonkeyPatch("mongodb-core", {versionSpecifier: "*", patch: mongodbcoreConnectionRecordPatchFunction});
        }
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));

        const events: Array<IStandardEvent<IMongoData>> = [];
        channel.subscribe<IMongoData>("mongodb", function(event) {
            events.push(event);
        });

        const mongodb = require("mongodb");

        const z1 = Zone.current.fork({name: "1"});
        z1.run(() =>
        mongodb.MongoClient.connect("mongodb://localhost:27017/testdb", function(err, db) {
            if (err) {
                done(err);
            }
            const collection = db.collection("documents");

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

                    assert.equal(events.length, 2);
                    assert.equal(events[0].data.startedData.command.insert, "documents");
                    assert.equal(events[0].data.event.reply.n, 3);
                    assert.equal(events[0].data.succeeded, true);
                    assert.equal(events[1].data.startedData.command.delete, "documents");
                    assert.equal(events[1].data.event.reply.n, 1);
                    assert.equal(events[1].data.succeeded, true);

                    if (mode === Mode.RECORD) {
                        // For recording traces
                        // The mongoCommunications trace should consist of Buffer objects,
                        // which retain relevant data when JSON.stringified
                        fs.writeFileSync(tracePath, JSON.stringify(mongoCommunication));
                    }
                }).then(done, done));
            }));
        }));
    });
});

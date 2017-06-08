// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IStandardEvent} from "diagnostic-channel";

import {redisCommunication, redisConnectionRecordPatchFunction} from "./util/redis-mock-record";
import {makeRedisReplayFunction} from "./util/redis-mock-replay";

import {enable as enableRedis, IRedisData} from "../src/redis.pub";

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

describe("redis", function() {
    const traceName = "redis.trace.json";
    const tracePath = path.join(__dirname, "util", traceName);
    let client;
    let success: boolean = true;
    before(() => {
        enableRedis();
        if (mode === Mode.RECORD) {
            channel.registerMonkeyPatch("redis", {versionSpecifier: "*", patch: redisConnectionRecordPatchFunction});
        } else {
            const trace = require(tracePath);
            channel.registerMonkeyPatch("redis", {versionSpecifier: "*", patch: makeRedisReplayFunction(trace)});
        }
    });

    afterEach((done) => {
        const finish = () => {
            (<any>channel).reset();
            if ((<any>this).ctx.currentTest.state !== "passed") {
                success = false;
            }
            done();
        }
        if (client) {
            client.quit(finish);
        } else {
            finish();
        }
    });

    after(() => {
        if (mode === Mode.RECORD && success) {
            fs.writeFileSync(tracePath, JSON.stringify(redisCommunication));
        }
        if (!success) {
            throw new Error('Not a success');
        }
    })

    it("should fire events when we interact with it, and preserve context", function(done) {
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));

        const events: Array<IStandardEvent<IRedisData>> = [];
        channel.subscribe<IRedisData>("redis", (event) => events.push(event));

        const redis = require("redis");

        client = redis.createClient("redis://localhost");
        

        const z1 = Zone.current.fork({name: "1"});
        z1.run(() => {
            client.get("value", function(err, reply) {
                if (err) {
                    done(err);
                    return;
                }

                if (Zone.current !== z1) {
                    done(new Error("Context not preserved in redis get"));
                    return;
                }

                const initialValue = reply;

                const z2 = Zone.current.fork({name: "2"});
                z2.run(() => {
                    client.incr("value", function(err2, reply2) {
                        if (err2) {
                            done(err2);
                            return;
                        }

                        if (Zone.current !== z2) {
                            done(new Error("Context not preserved in redis incr"));
                            return;
                        }

                        try {
                            /* tslint:disable-next-line:no-bitwise */
                            assert.equal(reply2, initialValue | 0 + 1, "Mismatch in returned value");

                            assert.equal(events.length, 3);
                            assert.equal(events[0].data.commandObj.command, "info");
                            assert.equal(events[1].data.commandObj.command, "get");
                            assert.equal(events[2].data.commandObj.command, "incr");
                        } catch (e) {
                            done(e);
                            return;
                        }

                        done();
                    });
                });
            });
        });
    });

    it("should record events even if no callback is passed", function (done) {
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));

        const z1 = Zone.current.fork({name: "1"});

        const events = [];

        channel.subscribe<IRedisData>("redis", (event) => {
            events.push(event);
            if (events.length === 2) {
                // Skip the 'info' event which is always first
                if (Zone.current !== z1) {
                    done(new Error("Context not preserved without callback"));
                } else {
                    done();
                }
            }
        });

        const redis = require("redis");

        client = redis.createClient("redis://localhost");

        z1.run(() => {
            client.incr("value");
        });
    });
});

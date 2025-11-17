// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IStandardEvent} from "diagnostic-channel";

import {mysqlCommunication, mysqlConnectionRecordPatchFunction} from "./util/mysql-mock-record";
import {makeMysqlConnectionReplayFunction} from "./util/mysql-mock-replay";

import {enable as enableMysql, IMysqlData} from "../src/mysql.pub";

import * as Q from "q";

import "zone.js";

import * as assert from "assert";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

enum Mode {
    REPLAY = "REPLAY",
    RECORD = "RECORD",
}

let mode: Mode = Mode.REPLAY as Mode;

describe("mysql", function() {
    const server = net.createServer();

    before(() => {
        enableMysql();
    });
    after(() => { server.close(); });

    it("should fire events when we interact with it, and preserve context", function(done) {
        const traceName = "mysql.trace.json";
        const tracePath = path.join(__dirname, "util", traceName);

        if (mode === Mode.RECORD) {
            channel.registerMonkeyPatch("mysql", {versionSpecifier: "*", patch: mysqlConnectionRecordPatchFunction});
        } else {
            const trace = require(tracePath);
            channel.registerMonkeyPatch("mysql", {versionSpecifier: "*", patch: makeMysqlConnectionReplayFunction(trace)});
        }
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));

        const events: Array<IStandardEvent<IMysqlData>> = [];
        channel.subscribe<IMysqlData>("mysql", (event) => events.push(event));

        const mysql = require("mysql");

        const pool = mysql.createPool({
            connectionLimit: 2,
            host: process.env.CI ? "127.0.0.1" : "localhost",  // Force IPv4 in CI
            user: "root", 
            password: process.env.CI ? "root" : "secret",  // Use CI password in CI environment
            database: "test"
        });

        // Add error handler to prevent uncaught connection errors
        pool.on('error', (err: any) => {
            // Errors will be handled by the query callbacks
        });

        const z1 = Zone.current.fork({name: "1"});
        const z2 = Zone.current.fork({name: "2"});

        const promises = [];
        let testCompleted = false;

        // We need to ensure that once we run out of connections in the pool, context is still preserved
        z1.run(() => {
            for (let i = 0; i < 2; ++i) {
                promises.push( new Q.Promise((resolve, reject) =>
                    pool.query("select 1 as solution", function(err, results) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        if (results[0].solution !== 1) {
                            reject(new Error("Query gave incorrect result"));
                            return;
                        }
                        if (Zone.current !== z1) {
                            reject("Context not preserved");
                            return;
                        }
                        resolve();
                    })
                ));
            }
        });
        z2.run(() => {
            for (let i = 0; i < 2; ++i) {
                promises.push( new Q.Promise((resolve, reject) =>
                    pool.query("select 2 as solution", function(err, results) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        if (results[0].solution !== 2) {
                            reject(new Error("Query gave incorrect result"));
                            return;
                        }
                        if (Zone.current !== z2) {
                            reject("Context not preserved");
                            return;
                        }
                        resolve();

                    })
                ));
            }
        });

        Q.all(promises).then(() => {
            if (testCompleted) return;
            testCompleted = true;
            assert.equal(events.length, 4);

            if (mode === Mode.RECORD) {
                fs.writeFileSync(tracePath, JSON.stringify(mysqlCommunication));
            }
            done();
        }).catch((err) => {
            if (testCompleted) return;
            testCompleted = true;
            done(err);
        });
    });
});

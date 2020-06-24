// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import {channel, IStandardEvent} from "diagnostic-channel";
import * as fs from "fs";
import * as path from "path";
import {Promise} from "q";
import "zone.js";
import {enable as enablePostgresPool} from "../src/pg-pool.pub";
import {enable as enablePostgres, IPostgresData, IPostgresResult} from "../src/pg.pub";

interface IPostgresTest {
    text?: string;
    preparable?: {
        text: string;
        args: string[];
    };
    plan?: string;
    zone: Zone;
    err: Error;
    res: IPostgresResult;
}

describe("pg@8.x", () => {
    let pg;
    let copyFrom;
    let actual: IPostgresData = null;
    let client;
    let pool;
    const listener = (event: IStandardEvent<IPostgresData>) => {
        actual = event.data;
    };
    const dbSettings = {
        user: "postgres",
        password: "test",
        database: "postgres",
        host: "127.0.0.1",
        port: 14200,
    };
    const checkSuccess = (data: IPostgresTest): Error => {
        try {
            assert(data, "No data argument was provided to checkSuccess");
            assert(actual, "No events were published to the channel");

            if (data.err) {
                return data.err;
            }

            assert.equal(data.err, actual.error, "Invalid error object");
            assert.equal(data.res.rowCount, actual.result.rowCount, "query and actual have different number of rows");
            assert.equal(actual.database.host, dbSettings.host, "actual has incorrect host");
            assert(actual.duration > 0, "actual has non-positive duration");

            if (data.text) {
                assert.equal(actual.query.text, data.text, "actual has incorrect query text");
            } else if (data.preparable) {
                assert.equal(actual.query.preparable.text, data.preparable.text, "actual has incorrect preparable text");
                assert.deepEqual(actual.query.preparable.args, data.preparable.args, "actual has incorrect preparable arguments");
            } else {
                assert.equal(actual.query.plan, data.plan, "actual has incorrect query plan");
            }
            assert.equal(data.zone, Zone.current, "Context was not preserved");
            actual = null;
            return null;
        } catch (e) {
            return e;
        }
    };
    const checkFailure = (data: IPostgresTest): Error => {
        try {
            assert(data, "No data argument was provided to checkSuccess");
            assert(actual, "No events were published to the channel");

            if (!data.err) {
                return new Error("No error returned by bad query");
            }

            if (data.res) {
                assert.deepEqual(data.res, actual.result);
            }
            assert.equal(data.err, actual.error, "Error returned to callback does not match actual error");
            assert.equal(data.zone, Zone.current, "Context was not preserved");
            actual = null;
            return null;
        } catch (e) {
            return e;
        }
    };

    before(() => {
        enablePostgres();
        enablePostgresPool();
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));
        pg = require("pg");
        copyFrom = require("pg-copy-streams").from;
        pool = new pg.Pool({
            user: dbSettings.user,
            password: dbSettings.password,
            database: dbSettings.database,
            host: dbSettings.host,
            port: dbSettings.port,
            max: 2,
        });
    });

    beforeEach((done) => {
        channel.subscribe<IPostgresData>("postgres", listener);
        client = new pg.Client(dbSettings);
        client.connect(done);
    });

    afterEach((done) => {
        channel.unsubscribe<IPostgresData>("postgres", listener);
        actual = null;
        client.end(done);
    });

    after((done) => {
        pool.end(done);
    });

    it("should instrument pg-copy-streams", (done) => {
        const child = Zone.current.fork({name: "child"});
        child.run(() => {
            const stream = client.query(copyFrom("COPY postgres FROM STDIN"));
            const fileStream = fs.createReadStream(path.join(__dirname, "util", "some_table.tsv"));

            const runAssertions = (err: Error | null) => {
                done(checkFailure({
                    res: { command: "COPY postgres FROM STDIN", rowCount: 0},
                    err: err,
                    zone: child,
                }));
            };

            // @todo: run assertions on "finish" after setting up proper DB
            stream.on("error", (err) => {
                runAssertions(err);
            });
            fileStream.pipe(stream);
        });
    });

    it("should not return a promise if no callback is provided", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            const res = client.query("SELECT NOW()", (e1, r1) => {
                const bad = checkSuccess({
                    res: r1,
                    err: e1,
                    zone: child,
                    text: "SELECT NOW()",
                });

                if (bad) {
                    return done(bad);
                }

                client.query("SELECT nonexistent", (e2, r2) => {
                    done(checkFailure({
                        res: r2,
                        err: e2,
                        zone: child,
                        preparable: {
                            text: "SELECT $1",
                            args: ["0"],
                        },
                    }));
                });
            });

            assert.equal(res, undefined, "No promise is returned");
        });
    });

    it("should intercept client.query(text, values, callback)", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            client.query("SELECT $1::text", ["0"], (e1, r1) => {
                const bad = checkSuccess({
                    res: r1,
                    err: e1,
                    zone: child,
                    preparable: {
                        text: "SELECT $1::text",
                        args: ["0"],
                    },
                });

                if (bad) {
                    return done(bad);
                }

                client.query("SELECT nonexistant", ["0"], (e2, r2) => {
                    done(checkFailure({
                        res: r2,
                        err: e2,
                        zone: child,
                        preparable: {
                            text: "SELECT $1",
                            args: ["0"],
                        },
                    }));
                });
            });
        });
    });

    it("should intercept client.query(text, callback)", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            client.query("SELECT NOW()", (e1, r1) => {
                const bad = checkSuccess({
                    res: r1,
                    err: e1,
                    zone: child,
                    text: "SELECT NOW()",
                });

                if (bad) {
                    return done(bad);
                }

                client.query("SELECT nonexistent", (e2, r2) => {
                    done(checkFailure({
                        res: r2,
                        err: e2,
                        zone: child,
                        preparable: {
                            text: "SELECT $1",
                            args: ["0"],
                        },
                    }));
                });
            });
        });
    });

    it("should intercept client.query({text, callback})", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            client.query({text: "SELECT NOW()", callback: (e1, r1) => {
                const bad = checkSuccess({
                    res: r1,
                    err: e1,
                    zone: child,
                    text: "SELECT NOW()",
                });

                if (bad) {
                    return done(bad);
                }

                client.query({text: "SELECT nonexistent", callback: (e2, r2) => {
                    done(checkFailure({
                        res: r2,
                        err: e2,
                        zone: child,
                        preparable: {
                            text: "SELECT $1",
                            args: ["0"],
                        },
                    }));
                }});
            }});
        });
    });

    it("should intercept client.query({text}, callback)", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            client.query({text: "SELECT NOW()"}, (e1, r1) => {
                const bad = checkSuccess({
                    res: r1,
                    err: e1,
                    zone: child,
                    text: "SELECT NOW()",
                });

                if (bad) {
                    return done(bad);
                }

                client.query({text: "SELECT nonexistent"}, (e2, r2) => {
                    done(checkFailure({
                        res: r2,
                        err: e2,
                        zone: child,
                        preparable: {
                            text: "SELECT $1",
                            args: ["0"],
                        },
                    }));
                });
            });
        });
    });

    it("should intercept client.query(text, values)", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            client.query("SELECT $1::text", ["0"]).then((res) => {
                const bad = checkSuccess({
                    res: res,
                    err: null,
                    zone: child,
                    preparable: {
                        text: "SELECT $1::text",
                        args: ["0"],
                    },
                });

                if (bad) {
                    throw bad;
                }
            }).then(() => {
                return client.query("SELECT nonexistant", ["0"]).then(() => {
                    assert.equal(child, Zone.current, "Context was not preserved");
                    throw new Error("bad query was successful");
                }, (err) => {
                    const bad = checkFailure({
                        res: null,
                        err,
                        zone: child,
                        preparable: {
                            text: "SELECT $1",
                            args: ["0"],
                        },
                    });

                    if (bad) {
                        throw bad;
                    }
                });
            }).then(done, done);
        });
    });

    it("should intercept client.query({text, values})", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            client.query({text: "SELECT $1::text", values: ["0"]}).then((res) => {
                const bad = checkSuccess({
                    res: res,
                    err: null,
                    zone: child,
                    preparable: {
                        text: "SELECT $1::text",
                        args: ["0"],
                    },
                });

                if (bad) {
                    throw bad;
                }
            }).then(() => {
                return client.query({text: "SELECT nonexistant", values: ["0"]}).then(() => {
                    assert.equal(child, Zone.current, "Context was not preserved");
                    throw new Error("bad query was successful");
                }, (err) => {
                    const bad = checkFailure({
                        res: null,
                        err,
                        zone: child,
                        preparable: {
                            text: "SELECT $1",
                            args: ["0"],
                        },
                    });

                    if (bad) {
                        throw bad;
                    }
                });
            }).then(done, done);
        });
    });

    it("should intercept client.query(text)", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            client.query("SELECT NOW()").then((res) => {
                const bad = checkSuccess({
                    res: res,
                    err: null,
                    zone: child,
                    text: "SELECT NOW()",
                });

                if (bad) {
                    throw bad;
                }
            }).then(() => {
                return client.query("SELECT nonexistent").then(() => {
                    assert.equal(child, Zone.current, "Context was not preserved");
                    throw new Error("bad query was successful");
                }, (err) => {
                    const bad = checkFailure({
                        res: null,
                        err,
                        zone: child,
                        text: "SELECT nonexistent",
                    });

                    if (bad) {
                        throw bad;
                    }
                });
            }).then(done, done);
        });
    });

    it("should intercept pool.query(text)", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            pool.query("SELECT NOW()").then((res) => {
                done(checkSuccess({
                    res: res,
                    err: null,
                    zone: child,
                    text: "SELECT NOW()",
                }));
            }, done);
        });
    });

    it("should intercept pool.query(text, values)", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            pool.query("SELECT $1::text", ["0"]).then((res) => {
                done(checkSuccess({
                    res: res,
                    err: null,
                    zone: child,
                    preparable: {
                        text: "SELECT $1::text",
                        args: ["0"],
                    },
                }));
            }, done);
        });
    });

    it("should intercept pool.connect() with too many clients", function test(done) {
        const child = Zone.current.fork({name: "child"});

        child.run(() => {
            let c1err = new Error("c1err not assigned");

            pool.connect((e1, c1) => {
                if (e1) {
                    return done(e1);
                }

                pool.connect((e2, c2) => {
                    if (e2) {
                        return done(e2);
                    }

                    pool.connect((e3, c3) => {
                        if (e3) {
                            return done(e3);
                        }

                        c3.query("SELECT NOW()", (err, res) => {
                            c3.release(err);
                            c2.release();
                            done(checkSuccess({
                                res,
                                err,
                                zone: child,
                                text: "SELECT NOW()",
                            }));
                        });
                    });
                });

                c1.query("SELECT NOW()").then((res) => {
                    c1.release();
                    c1err = checkSuccess({
                        res,
                        err: null,
                        zone: child,
                        text: "SELECT NOW()",
                    });
                }, (e) => {
                    c1.release();
                    c1err = e;
                });
            });
        });
    });

    it("should handle the same callback being given to multiple client.query()s", function test(done) {
        let events = 0;
        let handlers = 0;
        const counter = (event: IStandardEvent<IPostgresData>) => {
            events += 1;
        };
        const queryHandler = (err, res) => {
            if (err) {
                throw err;
            }

            handlers += 1;
            if (handlers === 5) {
                assert.equal(events, 6, "subscriber called too many times");
                assert.equal(handlers, 5, "callback called too many times");
                done();
            }
        };
        const config = {
            text: "SELECT NOW()",
            callback: queryHandler,
        };

        channel.subscribe("postgres", counter);
        client.query("SELECT NOW()");
        client.query("SELECT NOW()", queryHandler);

        client.query(config);
        client.query(config);

        client.query("SELECT NOW()", config.callback);
        client.query("SELECT NOW()", config.callback);
        // client.query("SELECT NOW()")
        // .then(() => {
        //     assert.equal(events, 6, "subscriber called too many times");
        //     assert.equal(handlers, 5, "callback called too many times");
        //     channel.unsubscribe("postgres", counter);
        // }).then(done, done);
    });

    it("should preserve correct zones even when using the same callback in client.query()", function test(done) {
        function handler(err: Error, res: any) {
            zoneQueue.push(Zone.current);
            if (zoneQueue.length >= 2) {
                assert.ok(zoneQueue[0]);
                assert.ok(z1);
                assert.ok(zoneQueue[1]);
                assert.ok(z2);
                assert.equal(zoneQueue[0], z1, "First zoneQueue item is not z1");
                assert.equal(zoneQueue[1], z2, "Second zoneQueue item is not z2");
                done();
            }
        }
        const zoneQueue: Zone[] = [];
        const z1 = Zone.current.fork({name: "z1"});
        const z2 = Zone.current.fork({name: "z2"});

        z1.run<Promise<void>>(() => {
            return client.query("SELECT NOW()", handler);
        });
        z2.run<Promise<void>>(() => {
            return client.query("SELECT NOW()", handler);
        });
    });

    it("should preserve correct zones even when using the same callback in pool.connect()", function test(done) {
        function handler(err: Error, _: any, release: Function) {
            if (err) {
                rejecter(err);
            }
            zoneQueue.push(Zone.current);
            release();
            resolver();
        }

        let resolver;
        let rejecter;
        const zoneQueue: Zone[] = [];
        const z1 = Zone.current.fork({name: "z1"});
        const z2 = Zone.current.fork({name: "z2"});
        const p = new pg.Pool(dbSettings);

        z1.run<Promise<void>>(() => {
            return new Promise((res, rej) => {
                resolver = res;
                rejecter = rej;

                p.connect(handler);
            });
        }).then(() => {
            return z2.run<Promise<void>>(() => {
                return new Promise((res, rej) => {
                    resolver = res;
                    rejecter = rej;

                    p.connect(handler);
                });
            });
        }).then(() => {
            assert.equal(zoneQueue[0], z1, "First zoneQueue item is not z1");
            assert.equal(zoneQueue[1], z2, "Second zoneQueue item is not z2");
            return p.end();
        }).then(done, done);
    });

    it("should let the pg module throw its own errors with bad arguments", function test() {
        function assertPgError(e: Error) {
            const src = e.stack.split("\n").map((el) => el.trim())[1];
            return /node_modules[/\\]pg/.test(src);
        }

        assert.throws(() => client.query(), assertPgError, "query with no arguments did not throw from pg");
        // assert.doesNotThrow(() => client.query(1, ["0"], () => null), "query with invalid text should not immediately throw");
        assert.doesNotThrow(() => client.query({ random: "object" }, undefined, () => null), "query with invalid config object did not throw from pg");
    });
});

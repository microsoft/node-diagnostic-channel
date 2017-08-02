// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as assert from "assert";
import {channel, IStandardEvent, makePatchingRequire} from "diagnostic-channel";
import "zone.js";
import {enable as enablePostgres, IPostgresData, IPostgresResult} from "../src/postgres.pub";

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

describe("postgres-v6", () => {
    let pg;
    let actual: IPostgresData = null;
    let client;
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
        if (data.err) {
            return data.err;
        }

        try {
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
            return null;
        } catch (e) {
            return e;
        }
    };
    const checkFailure = (data: IPostgresTest): Error => {
        if (!data.err) {
            return new Error("No error returned by bad query");
        }

        try {
            assert.equal(data.err, actual.error, "Error returned to callback does not match actual error");
            assert.equal(data.zone, Zone.current, "Context was not preserved");
            return null;
        } catch (e) {
            return e;
        }
    };

    before(() => {
        enablePostgres();
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, "context preservation"));
        pg = require("pg");
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

    it("should intercept query(text, values, callback)", function test(done) {
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

                client.query("SELECT $1", ["0"], (e2, r2) => {
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

    it("should intercept query(text, callback)", function test(done) {
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

    it("should intercept query({text, callback})", function test(done) {
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

    it("should intercept query({text}, callback)", function test(done) {
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

    it("should intercept query(text, values)", function test(done) {
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
                return client.query("SELECT $1", ["0"]).then(() => {
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

    it("should intercept query({text, values})", function test(done) {
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
                return client.query({text: "SELECT $1", values: ["0"]}).then(() => {
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

    it("should intercept query(text)", function test(done) {
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
});

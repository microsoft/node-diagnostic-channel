
import {channel} from 'pubsub-channel';

import {mongodbcoreConnectionRecordPatchFunction, mongoCommunication} from './util/mongodbcore-mock-record';
import {mongodbcoreConnectionReplayPatchFunction} from './util/mongodbcore-mock-replay';
import '../mongodb-core.pub';
import '../mongodb.pub';

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

describe('mongodb', function () {

    it('should fire events when we communicate with a collection, and preserve context', function (done) {
        let context = 0;

        // Note:
        // We patch the underlying connection to record/replay a trace stored in util/mongodb.trace.json
        // This lets us validate the behavior of our mock as long as the mongo commands below are left unchanged,
        // or the trace is updated with a newly recorded version.
        channel.registerMonkeyPatch('mongodb-core', {versionSpecifier: "*", patch: mongodbcoreConnectionReplayPatchFunction});
        channel.addContextPreservation((cb) => {
                const originalContext = context;
                return function () {
                    const newContext = context;
                    context = originalContext;
                    const ret = cb.apply(this, arguments);
                    context = newContext;
                    return ret;
                }
        });

        const events = [];
        channel.subscribe('mongodb', function (event) {
            events.push(event);
        });

        let mongodb = require('mongodb');

        context = 1;
        mongodb.MongoClient.connect("mongodb://localhost:27017/testdb", function (err, db) {
            if (err) {
                done(err);
            }
            var collection = db.collection('documents');

            /*
            // TODO: test that context works with the assumptions we have made
            if (context !== 1) {
                done(new Error("Context not preserved in connect"));
                return;
            }
            */

            context = 2;
            collection.insertMany([
                {a: 1}, {a: 2}, {a: 3}
            ], function (err, result) {
                if (err) {
                    done(err);
                    return;
                }
                if (result.result.n !== 3) {
                    done(new Error("Did not insert 3 elements"));
                    return;
                }
                /*
                if (context !== 2) {
                    done(new Error("Context not preserved in insert callback"));
                    return;
                }
                */

                context = 3;
                collection.deleteOne({a: 3}).then((result) => {
                    /*
                    if (context !== 3) {
                        throw new Error("Context not preserved in delete promise");
                    }
                    */
                    if (result.deletedCount !== 1) {
                        done(new Error("Did not delete one element"));
                        return;
                    }

                    // For recording traces
                    //fs.writeFileSync(path.join(__dirname, "util", "mongodb.trace.json"), JSON.stringify(mongoCommunication));

                    assert.equal(events.length, 2);
                    assert.equal(events[0].data.startedData.command.insert, 'documents');
                    assert.equal(events[0].data.event.reply.n, 3)
                    assert.equal(events[0].data.succeeded, true);
                    assert.equal(events[1].data.startedData.command.delete, 'documents');
                    assert.equal(events[1].data.event.reply.n, 1);
                    assert.equal(events[1].data.succeeded, true);


                }).then(done, done);
            });
        });

        context = 4;
    });
});
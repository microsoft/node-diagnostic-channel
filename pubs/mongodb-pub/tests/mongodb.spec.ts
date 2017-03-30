
import {channel, IStandardEvent} from 'pubsub-channel';

import {mongodbcoreConnectionRecordPatchFunction, mongoCommunication} from './util/mongodbcore-mock-record';
import {mongodbcoreConnectionReplayPatchFunction} from './util/mongodbcore-mock-replay';
import '../mongodb-core.pub';
import '../mongodb.pub';

import {MongoData} from '../mongodb.pub';

import 'zone.js';

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

describe('mongodb', function () {

    it('should fire events when we communicate with a collection, and preserve context', function (done) {
        // Note:
        // We patch the underlying connection to record/replay a trace stored in util/mongodb.trace.json
        // This lets us validate the behavior of our mock as long as the mongo commands below are left unchanged,
        // or the trace is updated with a newly recorded version.
        channel.registerMonkeyPatch('mongodb-core', {versionSpecifier: "*", patch: mongodbcoreConnectionReplayPatchFunction});
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, 'context preservation'));

        const events: IStandardEvent<MongoData>[] = [];
        channel.subscribe<MongoData>('mongodb', function (event) {
            events.push(event);
        });

        let mongodb = require('mongodb');

        const z1 = Zone.current.fork({name: '1'});
        z1.run(() => 
        mongodb.MongoClient.connect("mongodb://localhost:27017/testdb", function (err, db) {
            if (err) {
                done(err);
            }
            var collection = db.collection('documents');

            if (Zone.current != z1) {
                return done(new Error('Context not preserved in connect'));
            }

            const z2 = Zone.current.fork({name: '2'});
            z2.run(() =>
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
                
                if (Zone.current !== z2) {
                    done(new Error("Context not preserved in insert callback"));
                    return;
                }

                const z3 = Zone.current.fork({name: '3'});
                z3.run(() => 
                collection.deleteOne({a: 3}).then((result) => {
                    if (Zone.current !== z3) {
                        throw new Error("Context not preserved in delete promise");
                    }

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


                }).then(done, done));
            }));
        }));
    });
});
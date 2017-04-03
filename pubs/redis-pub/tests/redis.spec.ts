// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IStandardEvent} from 'pubsub-channel';

import {redisConnectionRecordPatchFunction, redisCommunication} from './util/redis-mock-record';
import {makeRedisReplayFunction} from './util/redis-mock-replay';

import '../redis.pub';

import {RedisData} from '../redis.pub';

import 'zone.js';

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

enum Mode {
    REPLAY,
    RECORD
}

let mode: Mode = Mode.REPLAY;

describe('redis', function () {

    it('should fire events when we interact with it, and preserve context', function (done) {
        const traceName = 'redis.trace.json';
        const tracePath = path.join(__dirname, 'util', traceName);

        if (mode === Mode.RECORD) {
            channel.registerMonkeyPatch('redis', {versionSpecifier: '*', patch:redisConnectionRecordPatchFunction});
        } else {
            const trace = require(tracePath);
            channel.registerMonkeyPatch('redis', {versionSpecifier: '*', patch: makeRedisReplayFunction(trace)});
        }
        channel.addContextPreservation((cb) => Zone.current.wrap(cb, 'context preservation'));

        const events: IStandardEvent<RedisData>[] = [];
        channel.subscribe<RedisData>('redis', (event) => events.push(event))

        const redis = require('redis');

        const client = redis.createClient('redis://localhost');

        const z1 = Zone.current.fork({name: '1'});
        z1.run(() => {
            client.get('value', function (err, reply) {
                if (err) {
                    done(err);
                    return;
                }

                if (Zone.current !== z1) {
                    done(new Error('Context not preserved in redis get'));
                    return;
                }

                const initialValue = reply;

                const z2 = Zone.current.fork({name: '2'});
                z2.run(() => {
                    client.incr('value', function (err, reply) {
                        if (err) {
                            done(err);
                            return;
                        }

                        if (Zone.current !== z2) {
                            done(new Error('Context not preserved in redis incr'));
                            return;
                        }

                        try {
                            //console.log(`${reply} =?= ${initialValue} + 1 == ${initialValue|0 + 1}`);
                            assert.equal(reply, initialValue|0 + 1);

                            assert.equal(events.length, 3);
                            assert.equal(events[0].data.command_obj.command, 'info');
                            assert.equal(events[1].data.command_obj.command, 'get');
                            assert.equal(events[2].data.command_obj.command, 'incr');
                        } catch (e) {
                            done(e);
                            return;
                        }

                        if (mode === Mode.RECORD) {
                            fs.writeFileSync(tracePath, JSON.stringify(redisCommunication));
                        }
                        done();
                    });
                });
            });
        })
    });
});
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";
import {EventEmitter} from "events";

// copy the pg.Result type: https://node-postgres.com/api/result
export interface IPostgresResult {
    rowCount: number;
    command: string;
}

export interface IPostgresData {
    query: {
        text?: string;
        plan?: string;
        preparable?: {
            text: string;
            args: any[];
        }
    };
    database: {
        host: string;
        port: string;
    };
    result?: IPostgresResult;
    duration: number;
    error?: Error;
}

type PostgresCallback = (err: Error, res: IPostgresResult) => any;

function postgres6PatchFunction(originalPg, originalPgPath) {
    const originalClientQuery = originalPg.Client.prototype.query;

    // this keeps track of user-supplied callback => patched callbacks so we don't keep
    // re-patching the same callback over and over for library functions
    // IMPORTANT: use a WeakMap so that we don't keep references to temporary/otherwise unreferenced functions
    const patchedCallbacks = new WeakMap<PostgresCallback, PostgresCallback>();

    // wherever the callback is passed, find it, save it, and remove it from the call
    // to the the original .query() function
    originalPg.Client.prototype.query = function query(config, values, callback) {
        const data: IPostgresData = {
            query: {},
            database: {
                host: this.connectionParameters.host,
                port: this.connectionParameters.port,
            },
            result: null,
            error: null,
            duration: 0,
        };
        const start = process.hrtime();
        let queryResult;

        function patchCallback(cb?: PostgresCallback, cachePatched?: boolean): PostgresCallback {
            const existingPatch = patchedCallbacks.get(cb);
            if (existingPatch) {
                // edge case where a previously-seen user callback is now being used
                // as the callback of a config object
                if (cachePatched) {
                    patchedCallbacks.set(existingPatch, existingPatch);
                }

                return existingPatch;
            }

            const trackingCallback = channel.bindToContext(function(err: Error, res: IPostgresResult): any {
                const end = process.hrtime(start);
                data.result = res && { rowCount: res.rowCount, command: res.command };
                data.error = err;
                data.duration = Math.ceil((end[0] * 1e3) + (end[1] / 1e6));
                channel.publish("postgres", data);

                // emulate weird internal behavior in pg@6
                // on success, the callback is called *before* query events are emitted
                // on failure, the callback is called *instead of* the query emitting events
                // with no events, that means no promises (since the promise is resolved/rejected in an event handler)
                // since we are always inserting ourselves as a callback, we have to restore the original
                // behavior if the user didn't provide one themselves
                if (err) {
                    if (cb) {
                        return cb.apply(this, arguments);
                    } else if (queryResult && queryResult instanceof EventEmitter) {
                        queryResult.emit("error", err);
                    }
                } else if (cb) {
                    cb.apply(this, arguments);
                }
            });

            if (cachePatched) {
                // this should only happen in the case of config.callback = patch(config.callback)
                patchedCallbacks.set(trackingCallback, trackingCallback);
            }

            if (cb) {
                patchedCallbacks.set(cb, trackingCallback);
            }

            return trackingCallback;
        }

        // this function takes too many variations of aguments.
        // this patches any provided callback or creates a new callback if one wasn't provided.
        // since the callback is always called (if provided) in addition to always having a Promisified
        // EventEmitter returned (well, sometimes -- see above), its safe to insert a callback if none was given
        if (typeof config === "string") {
            if (values instanceof Array) {
                data.query.preparable = {
                    text: config,
                    args: values,
                };
                callback = patchCallback(callback);
            } else {
                data.query.text = config;

                // pg v6 will, for some reason, accept both
                // client.query("...", undefined, () => {...})
                // **and**
                // client.query("...", () => {...});
                // Internally, precedence is given to the callback argument
                if (callback) {
                    callback = patchCallback(callback);
                } else {
                    values = patchCallback(values);
                }
            }
        } else {
            if (typeof config.name === "string") {
                data.query.plan = config.name;
            } else if (config.values instanceof Array) {
                data.query.preparable = {
                    text: config.text,
                    args: config.values,
                };
            } else {
                data.query.text = config.text;
            }

            if (callback) {
                callback = patchCallback(callback);
            } else if (values) {
                values = patchCallback(values);
            } else {
                config.callback = patchCallback(config.callback, true);
            }
        }

        queryResult = originalClientQuery.call(this, config, values, callback);
        return queryResult;
    };

    return originalPg;
}

export const postgres6: IModulePatcher = {
    versionSpecifier: ">= 6.0.0 <= 6.4.1",
    patch: postgres6PatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("pg", postgres6);
}

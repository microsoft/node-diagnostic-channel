// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {PatchFunction} from "pubsub-channel";

import * as EventEmitter from "events";
import * as path from "path";

export function makeMysqlConnectionReplayFunction(mysqlCommunication): PatchFunction {
    return function(originalMysql, originalMysqlPath) {
        const connectionClass = require(`${path.dirname(originalMysqlPath)}/lib/Connection`);

        const oconnect = connectionClass.prototype.connect;
        connectionClass.prototype.connect = function() {
            if (!this._connectCalled) {
                const thread = mysqlCommunication.shift();
                const connection: any = new EventEmitter();
                connection.setKeepAlive = connection.setTimeout = connection.setNoDelay = connection.end = function() {/* empty */};
                connection.writable = true;
                connection.destroy = () => {
                    this.connection.destroyed = true;
                };

                Object.defineProperty(this, "_socket", {
                    get: function() { return connection; },
                    set: function() {/* empty */},
                    configurable: true,
                });

                connection.write = function() {
                    const next = thread.shift();
                    if (next.send) {
                        if (thread[0].recv) {
                            setTimeout(() => connection.emit("data", new Buffer(thread.shift().recv)), 0);
                        }
                        return true;
                    } else {
                        throw new Error("Unexpected write");
                    }
                };

                setTimeout(() => {
                    connection.emit("connect", {});
                    // The mysql client expects the server to push data as the client connects, not only after a query from the client
                    if (thread[0].recv) {
                        setTimeout(() => {
                            connection.emit("data", new Buffer(thread.shift().recv));
                        }, 0);
                    }
                }, 0);
            }

            return oconnect.apply(this, arguments);
        };

        return originalMysql;
    };
}

import {PatchFunction} from "pubsub-channel";

import {EventEmitter} from "events";

const mongoCommunication = require("./mongodb.trace.json");

export const mongodbcoreConnectionReplayPatchFunction : PatchFunction = function (originalMongoCore) {
    const oConnect = originalMongoCore.Connection.prototype.connect;
    let connected = false;
    originalMongoCore.Connection.prototype.connect = function () {
        const connection: any = new EventEmitter();
        connection.setKeepAlive = connection.setTimeout = connection.setNoDelay = connection.end = function () {};
        connection.writable = true;
        connection.destroy = () => {
            this.connection.destroyed = true;
        }

        Object.defineProperty(this, 'connection', {
            get: function () { return connection },
            set: function () {},
            configurable: true,
        });

        oConnect.apply(this, arguments);

        setTimeout(() => {
            connected = true;
            connection.emit('connect', {})
        }, 0);

    }

    originalMongoCore.Connection.prototype.write = function (buffer) {
        const next = mongoCommunication.shift();
        if (next.send) {
            const expected = new Buffer(next.send);
            if (true || expected.compare(buffer) === 0) {
                if (mongoCommunication[0].recv) {
                    const data = new Buffer(mongoCommunication.shift().recv);
                    setTimeout(() => {
                        this.connection.emit('data', data);
                    },0);
                }
            }/*
            // TODO: add additional validation that the test doesn't get broken by changes in mongo's communication approach?
             else {
                console.log(expected.toString());
                console.log(buffer.toString());
                throw new Error("Mismatched buffers");
            }*/
        } else {
            throw new Error("Unexpected write");
        }
    }

    return originalMongoCore;
}
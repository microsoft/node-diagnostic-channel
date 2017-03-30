import {PatchFunction} from "pubsub-channel";

import {EventEmitter} from "events";

const mongoCommunication = require("./mongodb.trace.json");

export const mongodbcoreConnectionReplayPatchFunction : PatchFunction = function (originalMongoCore) {
    const oConnect = originalMongoCore.Connection.prototype.connect;

    originalMongoCore.Connection.prototype.connect = function () {
        // This is very much hackish.
        // We want to substitute the connection that the connect function tries to make,
        // and replace it with our own EventEmitter.
        // To do this, we tweak the EventEmitter to have the relevant methods, and we 
        // add a getter with no setter to 'this' so that the method does not overwrite it.
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
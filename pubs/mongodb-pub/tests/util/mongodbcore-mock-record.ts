import {PatchFunction} from "pubsub-channel";


export const mongoCommunication = [];

export const mongodbcoreConnectionRecordPatchFunction : PatchFunction = function (originalMongoCore) {
    const oconnect = originalMongoCore.Connection.prototype.connect;
    originalMongoCore.Connection.prototype.connect = function () {
        const ret = oconnect.apply(this, arguments);

        this.connection.on('data', (data) => {
            mongoCommunication.push({recv: data})
        });
        return ret;
    }

    const owrite = originalMongoCore.Connection.prototype.write;
    originalMongoCore.Connection.prototype.write = function (buffer) {
        mongoCommunication.push({send: buffer});
        return owrite.apply(this,arguments);
    }

    /*const osconnect = originalMongoCore.Server.prototype.connect;
    originalMongoCore.Server.prototype.connect = function () {
        const ret = osconnect.apply(this, arguments);
        const opwrite = this.s.pool.write;
        this.s.pool.write = function () {
            console.log(new Error().stack);
            return opwrite.apply(this, arguments);
        }
        return ret;
    }*/

    return originalMongoCore;
}
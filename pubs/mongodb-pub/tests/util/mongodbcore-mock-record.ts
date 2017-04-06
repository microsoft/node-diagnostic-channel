// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {PatchFunction} from "pubsub-channel";

export const mongoCommunication = [];

export const mongodbcoreConnectionRecordPatchFunction: PatchFunction = function(originalMongoCore) {
    const oconnect = originalMongoCore.Connection.prototype.connect;
    originalMongoCore.Connection.prototype.connect = function() {
        const ret = oconnect.apply(this, arguments);

        this.connection.on("data", (data) => {
            mongoCommunication.push({recv: data});
        });
        return ret;
    };

    const owrite = originalMongoCore.Connection.prototype.write;
    originalMongoCore.Connection.prototype.write = function(buffer) {
        mongoCommunication.push({send: buffer});
        return owrite.apply(this, arguments);
    };

    return originalMongoCore;
};

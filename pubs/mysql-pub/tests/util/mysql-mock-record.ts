// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {PatchFunction} from "pubsub-channel";

import * as path from 'path';

export const mysqlCommunication = [];

export const mysqlConnectionRecordPatchFunction : PatchFunction = function (originalMysql, originalMysqlPath) {
    const connectionClass = require(`${path.dirname(originalMysqlPath)}/lib/Connection`);

    const oconnect = connectionClass.prototype.connect;
    connectionClass.prototype.connect = function () {
        const ret = oconnect.apply(this, arguments);

        // Mysql uses a pool of connections,
        // so we track each pool as an independant thread
        const thread = [];
        mysqlCommunication.push(thread);

        this._socket.prependListener('data', function (data) {
            console.log("socket data");
            thread.push({recv: data});
        });
        const owrite = this._socket.write;
        this._socket.write = function (data) {
            thread.push({send: data});
            return owrite.apply(this, arguments);
        }
        return ret;
    }
    
    return originalMysql;
}
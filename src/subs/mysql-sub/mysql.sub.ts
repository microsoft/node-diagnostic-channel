// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");
import {channel, IStandardEvent} from "diagnostic-channel";

import {mysql} from "diagnostic-channel-publishers";

export const subscriber = (event: IStandardEvent<mysql.IMysqlData>) => {
    if (ApplicationInsights.defaultClient) {
        const queryObj = event.data.query || {};
        const sqlString = queryObj.sql || "Unknown query";
        const success = !event.data.err;

        const connection = queryObj._connection || {};
        const connectionConfig = connection.config || {};
        const dbName = connectionConfig.socketPath ? connectionConfig.socketPath : `${connectionConfig.host || "localhost"}:${connectionConfig.port}`;
        ApplicationInsights.defaultClient.trackDependency({
                target: dbName,
                name: sqlString,
                data: sqlString,
                duration: event.data.duration,
                success: success,
                // TODO: transmit result code from mysql
                resultCode: success ? "0" : "1",
                dependencyTypeName: "mysql"});
    }
};

channel.subscribe<mysql.IMysqlData>("mysql", subscriber);

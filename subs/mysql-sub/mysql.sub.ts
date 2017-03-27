// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {channel} from "pubsub-channel";

export const subscriber = (event) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        const queryObj = event.query || {};
        const sqlString = queryObj.sql || "Unknown query";
        const success = !event.err;

        const connection = queryObj._connection || {};
        const connectionConfig = connection.config || {};
        const dbName = connectionConfig.socketPath ? connectionConfig.socketPath : `${connectionConfig.host || 'localhost'}:${connectionConfig.port}`;
        ApplicationInsights.client.trackDependency(
                dbName,
                sqlString,
                event.duration | 0,
                success,
                'mysql');
    }
};

channel.subscribe('mysql', subscriber);
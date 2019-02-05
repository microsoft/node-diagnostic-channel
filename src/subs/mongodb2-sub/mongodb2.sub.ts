// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");
import {channel, IStandardEvent} from "diagnostic-channel";

import {mongodb} from "diagnostic-channel-publishers";

export const subscriber = (event: IStandardEvent<mongodb.IMongoData>) => {
    if (ApplicationInsights.defaultClient) {
        const dbName = (event.data.startedData && event.data.startedData.databaseName) || "Unknown database";
        ApplicationInsights.defaultClient
            .trackDependency({
                target: dbName,
                name: event.data.event.commandName,
                data: event.data.event.commandName,
                duration: event.data.event.duration,
                success: event.data.succeeded,
                // TODO: transmit result code from mongo
                resultCode: event.data.succeeded ? "0" : "1",
                dependencyTypeName: "mongodb"});

        if (!event.data.succeeded) {
            ApplicationInsights.defaultClient
                .trackException({exception: new Error(event.data.event.failure)});
        }
    }
};

channel.subscribe<mongodb.IMongoData>("mongodb", subscriber);

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {channel, IStandardEvent} from "pubsub-channel";

import {MongoData} from "mongodb-pub";

export const subscriber = (event: IStandardEvent<MongoData>) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        const dbName = (event.data.startedData && event.data.startedData.databaseName) || "Unknown database";
        ApplicationInsights.client
            .trackDependency(
                dbName,
                event.data.event.commandName,
                event.data.event.duration,
                event.data.succeeded,
                'mongodb');
                
        if (!event.data.succeeded) {
            ApplicationInsights.client
                .trackException(event.data.event.failure);
        }
    }
};

channel.subscribe<MongoData>("mongodb", subscriber);
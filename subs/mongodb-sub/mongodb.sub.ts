// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {channel} from "pubsub-channel";

channel.subscribe("mongodb", (event) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        const dbName = (event.startedData && event.startedData.databaseName) || "Unknown database";
        ApplicationInsights.client
            .trackDependency(
                dbName,
                event.event.commandName,
                event.event.duration,
                event.succeeded,
                'mongodb');
                
        if (!event.succeeded) {
            ApplicationInsights.client
                .trackException(event.event.failure);
        }
    }
});
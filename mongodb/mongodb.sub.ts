
import * as ApplicationInsights from "applicationinsights";
import {channel} from "../channel";

channel.subscribe("mongodb", (event) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        const dbName = event.startedData && event.startedData.databaseName;
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
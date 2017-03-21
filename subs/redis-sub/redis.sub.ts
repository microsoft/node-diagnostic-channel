
import * as ApplicationInsights from "applicationinsights";
import {channel} from "pubsub-channel";

channel.subscribe('redis', (event) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        ApplicationInsights.client.trackDependency(
            event.address,
            event.command_obj.command,
            event.duration,
            !event.err,
            'redis'
        );
    }
});
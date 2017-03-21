import * as ApplicationInsights from "applicationinsights";
import {Contracts} from "applicationinsights/Library/Contracts";

import {channel} from "pubsub-channel";

channel.subscribe("console", (event) => {
    if (ApplicationInsights.client) {
        ApplicationInsights.client.trackTrace(event.data, event.stderr ? Contracts.SeverityLevel.Warning : Contracts.SeverityLevel.Information);
    }
});
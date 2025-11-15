// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");

import {channel, IStandardEvent} from "diagnostic-channel";

import {console as consolePub} from "diagnostic-channel-publishers";

// SeverityLevel enum values for Application Insights
enum SeverityLevel {
    Verbose = 0,
    Information = 1,
    Warning = 2,
    Error = 3,
    Critical = 4
}

export const subscriber = (event: IStandardEvent<consolePub.IConsoleData>) => {
    if (ApplicationInsights.defaultClient) {
        const severity = event.data.stderr
            ? SeverityLevel.Warning
            : SeverityLevel.Information;
        ApplicationInsights.defaultClient.trackTrace({message: event.data.message, severity: severity as number});
    }
};

channel.subscribe<consolePub.IConsoleData>("console", subscriber);

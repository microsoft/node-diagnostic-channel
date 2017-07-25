// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");

import {channel, IStandardEvent} from "diagnostic-channel";

import {console as consolePub} from "diagnostic-channel-publishers";

export const subscriber = (event: IStandardEvent<consolePub.IConsoleData>) => {
    if (ApplicationInsights.client) {
        const severity = event.data.stderr
            ? ApplicationInsights.contracts.SeverityLevel.Warning
            : ApplicationInsights.contracts.SeverityLevel.Information;
        ApplicationInsights.client.trackTrace(event.data.message, severity);
    }
};

channel.subscribe<consolePub.IConsoleData>("console", subscriber);

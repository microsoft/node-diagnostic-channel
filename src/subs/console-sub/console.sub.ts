// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");

import {channel, IStandardEvent} from "diagnostic-channel";

import {console as consolePub} from "diagnostic-channel-publishers";

export const subscriber = (event: IStandardEvent<consolePub.IConsoleData>) => {
    if (ApplicationInsights.defaultClient) {
        const severity = event.data.stderr
            ? "Warning"
            : "Information";
        ApplicationInsights.defaultClient.trackTrace({message: event.data.message, severity: severity as any});
    }
};

channel.subscribe<consolePub.IConsoleData>("console", subscriber);

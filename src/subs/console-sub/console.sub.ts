// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");

import {channel, IStandardEvent} from "diagnostic-channel";

import {console as consolePub} from "diagnostic-channel-publishers";
import {SeverityLevel} from "applicationinsights/out/Declarations/Contracts";

export const subscriber = (event: IStandardEvent<consolePub.IConsoleData>) => {
    if (ApplicationInsights.defaultClient) {
        const severity = event.data.stderr
            ? SeverityLevel.Warning
            : SeverityLevel.Information;
        ApplicationInsights.defaultClient.trackTrace({message: event.data.message, severity: severity});
    }
};

channel.subscribe<consolePub.IConsoleData>("console", subscriber);

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {Contracts} from "applicationinsights/Library/Contracts";

import {channel, IStandardEvent} from "diagnostic-channel";

import {console as consolePub} from "diagnostic-channel-publishers";

export const subscriber = (event: IStandardEvent<consolePub.IConsoleData>) => {
    if (ApplicationInsights.client) {
        ApplicationInsights.client.trackTrace(event.data.message, event.data.stderr ? Contracts.SeverityLevel.Warning : Contracts.SeverityLevel.Information);
    }
};

channel.subscribe<consolePub.IConsoleData>("console", subscriber);
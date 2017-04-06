// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {Contracts} from "applicationinsights/Library/Contracts";

import {channel, IStandardEvent} from "pubsub-channel";

import {IConsoleData} from "console-pub";

export const subscriber = (event: IStandardEvent<IConsoleData>) => {
    if (ApplicationInsights.client) {
        ApplicationInsights.client.trackTrace(event.data.message, event.data.stderr ? Contracts.SeverityLevel.Warning : Contracts.SeverityLevel.Information);
    }
};

channel.subscribe<IConsoleData>("console", subscriber);
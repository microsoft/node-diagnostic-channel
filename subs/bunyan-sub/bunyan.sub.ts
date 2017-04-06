// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {Contracts} from "applicationinsights/Library/Contracts";

import {channel, IStandardEvent} from "pubsub-channel";

import {IBunyanData} from "bunyan-pub";

// Mapping from bunyan levels defined at https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js#L256
const bunyanToAILevelMap = {};
bunyanToAILevelMap[10] = Contracts.SeverityLevel.Verbose;
bunyanToAILevelMap[20] = Contracts.SeverityLevel.Verbose;
bunyanToAILevelMap[30] = Contracts.SeverityLevel.Information;
bunyanToAILevelMap[40] = Contracts.SeverityLevel.Warning;
bunyanToAILevelMap[50] = Contracts.SeverityLevel.Error;
bunyanToAILevelMap[60] = Contracts.SeverityLevel.Critical;

export const subscriber = (event: IStandardEvent<IBunyanData>) => {
    if (ApplicationInsights.client) {
        const AIlevel = bunyanToAILevelMap[event.data.level]
        ApplicationInsights.client.trackTrace(event.data.result, AIlevel)
    }
};

channel.subscribe<IBunyanData>('bunyan', subscriber);
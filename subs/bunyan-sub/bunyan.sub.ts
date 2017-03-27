// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {Contracts} from "applicationinsights/Library/Contracts";

import {channel} from "pubsub-channel";

// Mapping from bunyan levels defined at https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js#L256
const bunyanToAILevelMap = {};
bunyanToAILevelMap[10] = Contracts.SeverityLevel.Verbose;
bunyanToAILevelMap[20] = Contracts.SeverityLevel.Verbose;
bunyanToAILevelMap[30] = Contracts.SeverityLevel.Information;
bunyanToAILevelMap[40] = Contracts.SeverityLevel.Warning;
bunyanToAILevelMap[50] = Contracts.SeverityLevel.Error;
bunyanToAILevelMap[60] = Contracts.SeverityLevel.Critical;

export const subscriber = ({level, result}:{level: number, result: string}) => {
    if (ApplicationInsights.client) {
        const AIlevel = bunyanToAILevelMap[level]
        ApplicationInsights.client.trackTrace(result, AIlevel)
    }
};

channel.subscribe('bunyan', subscriber);
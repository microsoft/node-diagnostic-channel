// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");
import {channel, IStandardEvent} from "diagnostic-channel";
import {bunyan} from "diagnostic-channel-publishers";
import {SeverityLevel} from "applicationinsights/out/Declarations/Contracts";

// Mapping from bunyan levels defined at https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js#L256
const bunyanToAILevelMap = {};
bunyanToAILevelMap[10] = SeverityLevel.Verbose;
bunyanToAILevelMap[20] = SeverityLevel.Verbose;
bunyanToAILevelMap[30] = SeverityLevel.Information;
bunyanToAILevelMap[40] = SeverityLevel.Warning;
bunyanToAILevelMap[50] = SeverityLevel.Error;
bunyanToAILevelMap[60] = SeverityLevel.Critical;

export const subscriber = (event: IStandardEvent<bunyan.IBunyanData>) => {
    if (ApplicationInsights.defaultClient) {
        const AIlevel = bunyanToAILevelMap[event.data.level];
        ApplicationInsights.defaultClient.trackTrace({message: event.data.result, severity: AIlevel});
    }
};

channel.subscribe<bunyan.IBunyanData>("bunyan", subscriber);

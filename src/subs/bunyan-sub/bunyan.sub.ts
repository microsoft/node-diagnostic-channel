// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");
import {channel, IStandardEvent} from "diagnostic-channel";
import {bunyan} from "diagnostic-channel-publishers";

// Mapping from bunyan levels to Application Insights severity strings
// https://github.com/trentm/node-bunyan/blob/master/lib/bunyan.js#L256
const bunyanToAILevelMap: {[key: number]: string} = {};
bunyanToAILevelMap[10] = "Verbose";
bunyanToAILevelMap[20] = "Verbose";
bunyanToAILevelMap[30] = "Information";
bunyanToAILevelMap[40] = "Warning";
bunyanToAILevelMap[50] = "Error";
bunyanToAILevelMap[60] = "Critical";

export const subscriber = (event: IStandardEvent<bunyan.IBunyanData>) => {
    if (ApplicationInsights.defaultClient) {
        const AIlevel = bunyanToAILevelMap[event.data.level];
        ApplicationInsights.defaultClient.trackTrace({message: event.data.result, severity: AIlevel as any});
    }
};

channel.subscribe<bunyan.IBunyanData>("bunyan", subscriber);

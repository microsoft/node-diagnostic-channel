// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import ApplicationInsights = require("applicationinsights");
import {channel, IStandardEvent} from "diagnostic-channel";

import {redis} from "diagnostic-channel-publishers";

export const subscriber = (event: IStandardEvent<redis.IRedisData>) => {
    if (ApplicationInsights.defaultClient) {
        if (event.data.commandObj.command === "redis") {
            // We don't want to report 'info', it's irrelevant
            return;
        }

        ApplicationInsights.defaultClient.trackDependency({
            target: event.data.address,
            name: event.data.commandObj.command,
            data: event.data.commandObj.command,
            duration: event.data.duration,
            success: !event.data.err,
            resultCode: event.data.err ? "1" : "0",
            dependencyTypeName: "redis"});
    }
};

channel.subscribe<redis.IRedisData>("redis", subscriber);

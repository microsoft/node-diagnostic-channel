// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {channel, IStandardEvent} from "pubsub-channel";

import {IRedisData} from "redis-pub";

export const subscriber = (event: IStandardEvent<IRedisData>) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        if (event.data.commandObj.command === 'info') {
            // We don't want to report 'info', it's irrelevant
            return;
        }
        ApplicationInsights.client.trackDependency(
            event.data.address,
            event.data.commandObj.command,
            event.data.duration,
            !event.data.err,
            'redis'
        );
    }
};
channel.subscribe<IRedisData>('redis', subscriber);
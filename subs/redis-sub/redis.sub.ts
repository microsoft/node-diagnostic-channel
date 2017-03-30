// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {channel, IStandardEvent} from "pubsub-channel";

import {RedisData} from "redis-pub";

export const subscriber = (event: IStandardEvent<RedisData>) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        ApplicationInsights.client.trackDependency(
            event.data.address,
            event.data.command_obj.command,
            event.data.duration,
            !event.data.err,
            'redis'
        );
    }
};
channel.subscribe<RedisData>('redis', subscriber);
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as ApplicationInsights from "applicationinsights";
import {channel} from "pubsub-channel";

channel.subscribe('redis', (event) => {
    if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
        ApplicationInsights.client.trackDependency(
            event.address,
            event.command_obj.command,
            event.duration,
            !event.err,
            'redis'
        );
    }
});
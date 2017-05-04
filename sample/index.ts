// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This is for testing the overall integration

import * as ApplicationInsights from "applicationinsights"

// For demo purposes: hook up AI context preserving
// This is something that applicationinsights would do

declare var __dirname;
import {channel, IStandardEvent} from "diagnostic-channel";
channel.addContextPreservation((cb) => {
    return ApplicationInsights.wrapWithCorrelationContext(cb);
});

import {enable as enablePublishers} from "diagnostic-channel-publishers";
enablePublishers();

import "console-sub";
import "bunyan-sub";
import "mongodb-sub";
import "mysql-sub";
import "redis-sub";

// Verify that patches are applied
console.dir((<any>channel).getPatchesObject());

import {IConsoleData} from 'console-pub';

declare var process;

channel.subscribe('console', function (event: IStandardEvent<IConsoleData>) {
    process.stdout.write("Console subscriber>\t" + event.data.message)
})

console.log("Test message");
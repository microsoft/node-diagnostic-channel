// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

// This is for testing the overall integration

import * as ApplicationInsights from "applicationinsights"

// For demo purposes: hook up AI context preserving
// This is something that applicationinsights would do

declare var __dirname;
import {channel, IStandardEvent} from 'pubsub-channel';
channel.addContextPreservation((cb) => {
    return ApplicationInsights.wrapWithCorrelationContext(cb);
});

// This is also something that applicationinsights would do:
// channel.autoLoadPackages(path.join(__dirname, "..", "..", ".."))
// to try and escape node_modules/applicationinsights/subfolder and reach the parent folder.
// Alternately, perhaps path.dirname(require.main.paths[0]) as a likely folder containing package.json of the original 
channel.autoLoadPackages(__dirname);

// Verify that patches are applied
console.dir((<any>channel).getPatchesObject());

import {ConsoleData} from 'console-pub';

declare var process;

channel.subscribe('console', function (event: IStandardEvent<ConsoleData>) {
    process.stdout.write("Console subscriber>\t" + event.data.message)
})

console.log("Test message");
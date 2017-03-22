// This is for testing the overall integration

import * as ApplicationInsights from "applicationinsights"

// TODO: auto-load packages
import 'console-pub';
import 'mongodb-pub';

// For demo purposes: hook up AI context preserving
// This is something that applicationinsights would do

declare var Zone;
import {channel} from 'pubsub-channel';
channel.addContextPreservation((cb) => {
    return ApplicationInsights.wrapWithCorrelationContext(cb);
});

// Verify that patches are applied
console.dir(channel.getPatchesObject());

declare var process;

channel.subscribe('console', function (event) {
    process.stdout.write("Console subscriber>\t" + event.data)
})

console.log("Test message");
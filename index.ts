// This is for testing the overall integration

import * as ApplicationInsights from "applicationinsights"

// For demo purposes: hook up AI context preserving
// This is something that applicationinsights would do

declare var __dirname;
import {channel} from 'pubsub-channel';
channel.addContextPreservation((cb) => {
    return ApplicationInsights.wrapWithCorrelationContext(cb);
});

// This is also something that applicationinsights would do:
// channel.autoLoadPackages(path.join(__dirname, "..", "..", ".."))
// to try and escape node_modules/applicationinsights/subfolder and reach the parent folder.
// Alternately, perhaps path.dirname(require.main.paths[0]) as a likely folder containing package.json of the original 
channel.autoLoadPackages(__dirname);

// Verify that patches are applied
console.dir(channel.getPatchesObject());

declare var process;

channel.subscribe('console', function (event) {
    process.stdout.write("Console subscriber>\t" + event.data)
})

console.log("Test message");
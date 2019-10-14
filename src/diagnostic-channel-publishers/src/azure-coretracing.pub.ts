// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";
import * as types from "@azure/core-tracing";

const azureCoreTracinPatchFunction: PatchFunction = (tracing: typeof types) => {
    const origSpanStart = tracing.OpenCensusSpanPlugin.prototype.start;
    const origSpanEnd = tracing.OpenCensusSpanPlugin.prototype.end;

    tracing.OpenCensusSpanPlugin.prototype.start = function() {
        (this as types.OpenCensusSpanPlugin).addEvent("Application Insights Integration enabled");
        return origSpanStart.apply(this, arguments); // returns void
    }

    tracing.OpenCensusSpanPlugin.prototype.end = function() {
        const res = origSpanEnd.apply(this, arguments);
        channel.publish("azure-coretracing", this);
        return res; // returns void
    }

    return tracing;
}

export const azureCoreTracing: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: azureCoreTracinPatchFunction
};

export function enable() {
    channel.registerMonkeyPatch("@azure/core-tracing", azureCoreTracing);
}

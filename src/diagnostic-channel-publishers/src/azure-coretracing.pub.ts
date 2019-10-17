// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import { channel, IModulePatcher, PatchFunction } from "diagnostic-channel";
import * as coreTracingTypes from "@azure/core-tracing";

export const DEFAULT_TRACER_TAG = "__AzureMonitorTracer__";

/**
 * By default, @azure/core-tracing default tracer is a NoopTracer.
 * This patching changes the default tracer to a patched BasicTracer
 * which emits ended spans as diag-channel events.
 * @param coreTracing
 */
const azureCoreTracingPatchFunction: PatchFunction = (coreTracing: typeof coreTracingTypes) => {
    try {
        const BasicTracer = require('@opentelemetry/tracing').BasicTracer;
        const tracer = new BasicTracer();
        if (tracer) {
            // Patch tracer.startSpan(...)
            const origSpanStart = tracer.startSpan;
            tracer.startSpan = function startSpan() {
                const span: coreTracingTypes.Span = origSpanStart.apply(this, arguments);
                span.addEvent("Application Insights Integration enabled");

                // Patch span.end()
                const origEnd = span.end;
                span.end = function end(this: coreTracingTypes.Span) {
                    const res = origEnd.apply(this, arguments);
                    channel.publish("azure-coretracing", this);
                    return res; // void;
                }
                return span;
            }
        }
        tracer[DEFAULT_TRACER_TAG] = true;
        coreTracing.setTracer(tracer)
    } finally {
        return coreTracing;
    }
}

export const azureCoreTracing: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: azureCoreTracingPatchFunction
};

export function enable() {
    channel.registerMonkeyPatch("@azure/core-tracing", azureCoreTracing);
}

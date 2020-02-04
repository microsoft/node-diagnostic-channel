// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as coreTracingTypes from "@azure/core-tracing";
import * as opentelemetryTypes from "@opentelemetry/types";
import { channel, IModulePatcher, PatchFunction } from "diagnostic-channel";

export const AzureMonitorSymbol = "Azure_Monitor_Tracer";

/**
 * By default, @azure/core-tracing default tracer is a NoopTracer.
 * This patching changes the default tracer to a patched BasicTracer
 * which emits ended spans as diag-channel events.
 *
 * The @opentelemetry/tracing package must be installed to use these patches
 * https://www.npmjs.com/package/@opentelemetry/tracing
 * @param coreTracing
 */
const azureCoreTracingPatchFunction: PatchFunction = (coreTracing: typeof coreTracingTypes) => {
    try {
        const tracing = require("@opentelemetry/tracing");
        const tracerConfig = channel.spanContextPropagator
            ? { scopeManager: channel.spanContextPropagator }
            : undefined;
        const registry = new tracing.BasicTracerRegistry(tracerConfig);
        const tracer = registry.getTracer("applicationinsights", undefined, tracerConfig);

        // Patch startSpan instead of using spanProcessor.onStart because parentSpan must be
        // set while the span is constructed
        const startSpanOriginal = tracer.startSpan;
        tracer.startSpan = function(name: string, options?: opentelemetryTypes.SpanOptions) {
            // if no parent span was provided, apply the current context
            if (!options || !options.parent) {
                const parentOperation = tracer.getCurrentSpan();
                if (parentOperation && parentOperation.operation && parentOperation.operation.traceparent) {
                    options = {
                        ...options,
                        parent: {
                            traceId: parentOperation.operation.traceparent.traceId,
                            spanId: parentOperation.operation.traceparent.spanId,
                        }
                    }
                }
            }
            const span = startSpanOriginal.call(this, name, options);
            const originalEnd = span.end;
            span.end = function() {
                const result = originalEnd.apply(this, arguments)
                channel.publish("azure-coretracing", span);
                return result;
            }
            return span;
        };

        tracer[AzureMonitorSymbol] = true;
        coreTracing.setTracer(tracer); // recordSpanData is not present on BasicTracer - cast to any
    } catch (e) { }
    return coreTracing;
};

export const azureCoreTracing: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: azureCoreTracingPatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("@azure/core-tracing", azureCoreTracing);
}

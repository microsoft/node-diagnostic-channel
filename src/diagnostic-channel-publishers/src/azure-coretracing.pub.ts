// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as coreTracingTypes from "@azure/core-tracing";
import * as opentelemetryTypes from "@opentelemetry/api";
import * as tracingTypes from "@opentelemetry/tracing";
import { channel, IModulePatcher, PatchFunction } from "diagnostic-channel";

export const AzureMonitorSymbol = "Azure_Monitor_Tracer";
let isPatched = false;

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
    if (isPatched) {
        // tracer is already cached -- noop
        return coreTracing;
    }

    try {
        const tracing = require("@opentelemetry/tracing") as typeof tracingTypes;
        const opentelemetry = require("@opentelemetry/api") as typeof opentelemetryTypes;
        const tracerConfig: tracingTypes.SDKRegistrationConfig = channel.spanContextPropagator
            ? { contextManager: channel.spanContextPropagator }
            : undefined;
        new tracing.BasicTracerProvider().register(tracerConfig);
        const tracer = opentelemetry.trace.getTracer("applicationinsights tracer");

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
                            traceFlags: 1, // Sampled in
                        },
                    };
                }
            }
            const span = startSpanOriginal.call(this, name, options);
            const originalEnd = span.end;
            span.end = function() {
                const result = originalEnd.apply(this, arguments);
                channel.publish("azure-coretracing", span);
                return result;
            };
            return span;
        };

        tracer[AzureMonitorSymbol] = true;
        coreTracing.setTracer(tracer as any); // recordSpanData is not present on BasicTracer - cast to any
        isPatched = true;
    } catch (e) { /* squash errors */ }
    return coreTracing;
};

export const azureCoreTracing: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: azureCoreTracingPatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("@azure/core-tracing", azureCoreTracing);
}

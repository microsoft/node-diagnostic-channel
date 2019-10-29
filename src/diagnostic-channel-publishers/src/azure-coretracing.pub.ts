// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as coreTracingTypes from "@azure/core-tracing";
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
        const BasicTracer = require("@opentelemetry/tracing").BasicTracer;
        const tracer = new BasicTracer() as coreTracingTypes.Tracer & { addSpanProcessor: Function };
        // Patch startSpan instead of using spanProcessor.onStart because parentSpan must be
        // set while the span is constructed
        const startSpanOriginal = tracer.startSpan;
        tracer.startSpan = function(name: string, options?: coreTracingTypes.SpanOptions) {
            // if no parent span was provided, apply the current context
            if (!options || !options.parent) {
                const parentOperation = channel.getParentOperationContext();
                if (parentOperation) {
                    options = {
                        ...options,
                        parent: {
                            traceId: parentOperation.traceId,
                            spanId: parentOperation.spanId,
                        },
                    };
                }
            }

            const span = startSpanOriginal.call(this, name, options);
            span.addEvent("Application Insights Integration enabled");
            return span;
        };

        tracer.addSpanProcessor(new AzureMonitorSpanProcessor());
        tracer[AzureMonitorSymbol] = true;
        coreTracing.setTracer(tracer as any); // recordSpanData is not present on BasicTracer - cast to any
    } catch (e) { /* squash errors */ }
    return coreTracing;
};

class AzureMonitorSpanProcessor {
    public onStart(span: coreTracingTypes.Span): void {
        // noop since startSpan is already patched
    }

    public onEnd(span: coreTracingTypes.Span): void {
        channel.publish("azure-coretracing", span);
    }

    public shutdown(): void {
        // noop
    }
}

export const azureCoreTracing: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: azureCoreTracingPatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("@azure/core-tracing", azureCoreTracing);
}

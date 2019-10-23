// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as applicationinsights from 'applicationinsights/out/AutoCollection/CorrelationContextManager';
import * as coreTracingTypes from "@azure/core-tracing";
import * as tracingTypes from "@opentelemetry/tracing";
import * as opentelemetryTypes from "@opentelemetry/types";
import * as opentelemetryScope from "@opentelemetry/scope-base";
import { channel, IModulePatcher, PatchFunction } from "diagnostic-channel";

export const AzureMonitorSymbol = Symbol("Azure Monitor Tracer");
let _scopeManager: opentelemetryScope.ScopeManager = null;

/**
 * By default, @azure/core-tracing default tracer is a NoopTracer.
 * This patching changes the default tracer to a patched BasicTracer
 * which emits ended spans as diag-channel events.
 * @param coreTracing
 */
const azureCoreTracingPatchFunction: PatchFunction = (coreTracing: typeof coreTracingTypes) => {
    try {
        const BasicTracer: typeof tracingTypes.BasicTracer = require("@opentelemetry/tracing").BasicTracer;
        const tracer: tracingTypes.BasicTracer = new BasicTracer({
            scopeManager: _scopeManager,
        });

        // Patch startSpan instead of using spanProcessor.onStart because parentSpan must be
        // set while the span is constructed
        const startSpanOriginal = tracer.startSpan;
        tracer.startSpan = function(name: string, options?: opentelemetryTypes.SpanOptions) {
            // if no parent span was provided, apply the current context
            if (!options || !options.parent) {
                const parentOperation = _scopeManager.active() as applicationinsights.CorrelationContext | null;
                // If there is a current context and it is W3C compatible, apply it as parent span
                if (parentOperation && parentOperation.operation.traceparent) {
                    const operation = parentOperation.operation;
                    options = {
                        ...options,
                        parent: {
                            traceId: operation.traceparent.traceId,
                            spanId: operation.traceparent.spanId,
                        },
                    };
                }
            }

            const span = startSpanOriginal.call(this, name, options);
            span.addEvent("Application Insights Integration enabled");
            return span;
        }

        tracer.addSpanProcessor(new AzureMonitorSpanProcessor());
        tracer[AzureMonitorSymbol] = true;
        coreTracing.setTracer(tracer as any); // recordSpanData is not present on BasicTracer - cast to any
    } catch (e) { /* squash errors */ }
    return coreTracing;
};

class AzureMonitorSpanProcessor implements tracingTypes.SpanProcessor {
    public onStart(span: opentelemetryTypes.Span): void {
        // noop since startSpan is already patched
    }

    public onEnd(span: opentelemetryTypes.Span): void {
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

export function enable(scopeManager: opentelemetryScope.ScopeManager) {
    if (!scopeManager) throw new Error("No scope manager was provided to @azure/core-tracing patch");
    _scopeManager = scopeManager;
    channel.registerMonkeyPatch("@azure/core-tracing", azureCoreTracing);
}

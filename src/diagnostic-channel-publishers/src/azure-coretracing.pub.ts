// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import { channel, IModulePatcher, PatchFunction } from "diagnostic-channel";
import * as coreTracingTypes from "@azure/core-tracing";
import * as tracingTypes from '@opentelemetry/tracing';
import * as opentelemetryTypes from '@opentelemetry/types';

export const AzureMonitorSymbol = Symbol("Azure Monitor Tracer");

/**
 * By default, @azure/core-tracing default tracer is a NoopTracer.
 * This patching changes the default tracer to a patched BasicTracer
 * which emits ended spans as diag-channel events.
 * @param coreTracing
 */
const azureCoreTracingPatchFunction: PatchFunction = (coreTracing: typeof coreTracingTypes) => {
    try {
        const BasicTracer = require('@opentelemetry/tracing').BasicTracer;
        const tracer: tracingTypes.BasicTracer = new BasicTracer();
        tracer.addSpanProcessor(new AzureMonitorSpanProcessor());
        tracer[AzureMonitorSymbol] = true;
        coreTracing.setTracer(tracer as any)
    } finally {
        return coreTracing;
    }
}

export class AzureMonitorSpanProcessor implements tracingTypes.SpanProcessor {
    onStart(span: opentelemetryTypes.Span): void {
        span.addEvent("Application Insights Integration enabled");
    }

    onEnd(span: opentelemetryTypes.Span): void {
        channel.publish("azure-coretracing", this);
    }

    shutdown(): void {
        // noop
    }
}

export const azureCoreTracing: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: azureCoreTracingPatchFunction
};

export function enable() {
    channel.registerMonkeyPatch("@azure/core-tracing", azureCoreTracing);
}

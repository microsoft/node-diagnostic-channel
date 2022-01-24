// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as coreTracingTypes from "@azure/core-tracing";
import * as azureSdkInstrTypes from "@azure/opentelemetry-instrumentation-azure-sdk";
import * as opentelemetryTypes from "@opentelemetry/api";
import * as opentelemetryInstrTypes from "@opentelemetry/instrumentation";
import * as tracingTypes from "@opentelemetry/sdk-trace-base";

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
        const tracing = require("@opentelemetry/sdk-trace-base") as typeof tracingTypes;
        const api = require("@opentelemetry/api") as typeof opentelemetryTypes;
        const defaultProvider = new tracing.BasicTracerProvider();
        const defaultTracer = defaultProvider.getTracer("applicationinsights tracer");

        // Patch Azure SDK setTracer, @azure/core-tracing <= 1.0.0-preview.12
        if ((<any>coreTracing).setTracer) {
            const setTracerOriginal = (<any>coreTracing).setTracer;
            (<any>coreTracing).setTracer = function (tracer: any) {
                // Patch startSpan instead of using spanProcessor.onStart because parentSpan must be
                // set while the span is constructed
                const startSpanOriginal = tracer.startSpan;
                tracer.startSpan = function (name: string, options?: opentelemetryTypes.SpanOptions, context?: opentelemetryTypes.Context) {
                    const span = startSpanOriginal.call(this, name, options, context);
                    const originalEnd = span.end;
                    span.end = function () {
                        const result = originalEnd.apply(this, arguments);
                        channel.publish("azure-coretracing", span);
                        return result;
                    };
                    return span;
                };
                tracer[AzureMonitorSymbol] = true;
                setTracerOriginal.call(this, tracer);
            };
            api.trace.getSpan(api.context.active()); // seed OpenTelemetryScopeManagerWrapper with "active" symbol
            (<any>coreTracing).setTracer(defaultTracer);
        } else { // Patch OpenTelemetry setGlobalTracerProvider  @azure/core-tracing > 1.0.0-preview.13
            const setGlobalTracerProviderOriginal = api.trace.setGlobalTracerProvider;
            api.trace.setGlobalTracerProvider = function (tracerProvider: opentelemetryTypes.TracerProvider) {
                const getTracerOriginal = tracerProvider.getTracer;
                tracerProvider.getTracer = function (tracerName, version) {
                    const tracer = getTracerOriginal.call(this, tracerName, version);
                    if (!tracer[exports.AzureMonitorSymbol]) { // Avoid patching multiple times
                        const startSpanOriginal = tracer.startSpan;
                        tracer.startSpan = function (spanName: string, options?: opentelemetryTypes.SpanOptions, context?: opentelemetryTypes.Context) {
                            const span = startSpanOriginal.call(this, spanName, options, context);
                            const originalEnd = span.end;
                            span.end = function () {
                                const result = originalEnd.apply(this, arguments);
                                channel.publish("azure-coretracing", span);
                                return result;
                            };
                            return span;
                        };


                        tracer[AzureMonitorSymbol] = true;
                    }
                    return tracer;
                };
                return setGlobalTracerProviderOriginal.call(this, tracerProvider);
            };
            defaultProvider.register();
            api.trace.getSpan(api.context.active()); // seed OpenTelemetryScopeManagerWrapper with "active" symbol

            // Register Azure SDK instrumentation
            const openTelemetryInstr = require("@opentelemetry/instrumentation") as typeof opentelemetryInstrTypes;
            const azureSdkInstr = require("@azure/opentelemetry-instrumentation-azure-sdk") as typeof azureSdkInstrTypes;
            openTelemetryInstr.registerInstrumentations({
                instrumentations: [
                    azureSdkInstr.createAzureSdkInstrumentation(),
                ],
            });
        }

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

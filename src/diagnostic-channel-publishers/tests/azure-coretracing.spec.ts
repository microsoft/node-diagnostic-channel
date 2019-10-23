// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as coreTracingTypes from "@azure/core-tracing";
import * as assert from "assert";
import * as opentelemetryAsyncHooks from "@opentelemetry/scope-async-hooks";
import {channel, IStandardEvent} from "diagnostic-channel";
import {AzureMonitorSymbol, enable as enableAzureSDKTracing} from "../src/azure-coretracing.pub";

const assertSpans = (events, span) => {
    assert.equal(events.length, 0);
    span.end();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].data, span);
};

describe("@azure/core-tracing@1.0.0-preview4+", () => {
    let coretracing: typeof coreTracingTypes;
    let events: Array<IStandardEvent<coreTracingTypes.Span>>;
    let tracer: coreTracingTypes.Tracer;
    const scopeManager = new opentelemetryAsyncHooks.AsyncHooksScopeManager()

    before(() => {
        enableAzureSDKTracing(scopeManager);
        channel.subscribe<coreTracingTypes.Span>("azure-coretracing", function(span) {
            events.push(span);
        });
        coretracing = require("@azure/core-tracing");
        tracer = coretracing.getTracer();
    });

    beforeEach(() => {
        events = [];
    });

    it("should fire events when a span is ended", (done) => {
        assert.ok(tracer[AzureMonitorSymbol]);
        const span = tracer.startSpan("test span 1");
        assert.deepEqual(tracer.getCurrentSpan(), null);
        assertSpans(events, span);
        assert.deepEqual(span["events"][0].name, "Application Insights Integration enabled");
        done();
    });

    it("should propagate context across async span contexts", (done) => {
        assert.ok(tracer[AzureMonitorSymbol]);
        const operation = {
            traceparent: {
                traceId: "242b113d433edc752d80a86cf28af791",
                spanId: "87f1f98fbe876c24",
            }
        };
        scopeManager.with({ operation }, () => {
            const span = tracer.startSpan("test span 1");
            assert.equal(span.context().traceId, operation.traceparent.traceId);
            assert.notEqual(span.context().spanId, operation.traceparent.spanId);
            done();
        });
    });
});

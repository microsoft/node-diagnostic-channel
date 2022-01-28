// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import api from "@opentelemetry/api";
import * as assert from "assert";
import { channel, IStandardEvent } from "diagnostic-channel";
import { AzureMonitorSymbol, enable as enableAzureSDKTracing } from "../src/azure-coretracing.pub";

const assertSpans = (events, span) => {
    assert.equal(events.length, 0);
    span.end();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].data, span);
};

describe("@azure/core-tracing@1.0.0-preview9+", () => {
    let events: Array<IStandardEvent<any>>;
    let tracer;

    before(() => {
        enableAzureSDKTracing();
        channel.subscribe("azure-coretracing", function(span) {
            events.push(span);
        });
        const coreTracing = require("@azure/core-tracing");
        tracer = api.trace.getTracerProvider().getTracer("Test Tracer");
        coreTracing.setTracer(tracer);
    });

    beforeEach(() => {
        events = [];
    });

    it("should fire events when a span is ended", (done) => {
        assert.equal(tracer[AzureMonitorSymbol], true);
        const span = tracer.startSpan("test span 1");
        assert.deepEqual(api.trace.getSpan(api.context.active()), null);
        assertSpans(events, span);
        done();
    });
});

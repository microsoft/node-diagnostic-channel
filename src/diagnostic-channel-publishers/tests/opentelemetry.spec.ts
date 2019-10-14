// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {channel, IStandardEvent} from "diagnostic-channel";
import * as assert from "assert";
import * as tracerTypes from '@opentelemetry/node'
import {enable as enableOpenTelemetry, ApplicationInsightsSpanProcessor} from "../src/opentelemetry.pub";
import { Span } from '@opentelemetry/types';

const assertSpans = (tracer, events, span, done) => {
    assert.deepEqual(tracer.getCurrentSpan(), span);
    assert.equal(events.length, 0);
    span.end();
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].data, span);
    done();
}

describe("opentelemetry@0.x", () => {
    let events: Array<IStandardEvent<Span>>;
    let tracer: tracerTypes.NodeTracer;
    let opentelemetry: typeof tracerTypes;

    before(() => {
        enableOpenTelemetry();
        channel.subscribe<Span>("opentelemetry", function(span) {
            events.push(span);
        });
        opentelemetry = require("@opentelemetry/node-tracer");
    });

    beforeEach(() => {
        events = [];
        tracer = new opentelemetry.NodeTracer({});
    });

    afterEach(() => {
        tracer = null;
    });

    it("should fire events when a span is started or ended", (done) => {
        const span = tracer.startSpan('test span');
        assert.deepEqual(span["events"][0].name, "Application Insights Integration enabled");

        tracer.withSpan(span, () => {
            assertSpans(tracer, events, span, done);
        });
        assert.deepEqual(tracer.getCurrentSpan(), null);
    });

    it("should propagate context across Promises", (done) => {
        const span = tracer.startSpan('test span');
        assert.deepEqual(span["events"][0].name, "Application Insights Integration enabled");

        tracer.withSpan(span, () => {
            setTimeout(() => {
                assertSpans(tracer, events, span, done);
            });
        });
        assert.deepEqual(tracer.getCurrentSpan(), null);
    });

    it("should return a valid BasicTracer", (done) => {
        const { BasicTracer } = require("@opentelemetry/basic-tracer");
        const basicTracer = new BasicTracer();
        assert.ok(basicTracer);
        assert.ok(basicTracer.activeSpanProcessor._spanProcessors[0] instanceof ApplicationInsightsSpanProcessor);
        const span = basicTracer.startSpan("test span");

        basicTracer.withSpan(span, () => {
            assert.deepEqual(basicTracer.getCurrentSpan(), null);
            span.end();
            done();
        });
    })
});

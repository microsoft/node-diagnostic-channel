// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";
import * as opentelemtryTypes from '@opentelemetry/types';
import * as basicTracerTypes from '@opentelemetry/tracing';

const opentelemetryPatchFunction: PatchFunction = (ot) => {
    const origCtor = ot.BasicTracer.prototype.constructor;
    const origProto = ot.BasicTracer.prototype;

    // Patch BasicTracer constructor. Note: This patchfunction works because BasicTracer is patched before NodeTracer exists
    ot.BasicTracer = function constructor() {
        // create & copy dummy BasicTracer because it is not valid to call origCtor without "new".
        // This should be equivalent to origCtor.apply(this, arguments)
        const dummyTracer = new origCtor(...(arguments as any));
        Object.assign(this, dummyTracer, this);

        const appInsightsSpanProcessor = new ApplicationInsightsSpanProcessor();
        this.addSpanProcessor(appInsightsSpanProcessor);
    }
    ot.BasicTracer.prototype = origProto;
    // End patch

    return ot;
}

export class ApplicationInsightsSpanProcessor implements basicTracerTypes.SpanProcessor {
    constructor() {
    }

    public onStart(span: opentelemtryTypes.Span): void {
        span.addEvent("Application Insights Integration enabled");
    }

    public onEnd(span: opentelemtryTypes.Span): void {
        channel.publish("opentelemetry", span);
    }

    public shutdown(): void {
        // Noop
    }
}

export const opentelemetryBasicTracer: IModulePatcher = {
    versionSpecifier: "< 1.0.0",
    patch: opentelemetryPatchFunction
};

export function enable() {
    channel.registerMonkeyPatch("@opentelemetry/tracing", opentelemetryBasicTracer);
}

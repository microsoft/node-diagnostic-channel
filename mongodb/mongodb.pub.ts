/// <reference path="../IReplacement.d.ts" />

import {channel} from "../channel";

declare var Zone;

const mongodbPatchFunction: PatchFunction = function (originalMongo) {
    const listener = originalMongo.instrument({
        operationIdGenerator: {
            next: function () {
                if (Zone && Zone.current) {
                    // provide a function to restore the current context
                    return Zone.current.wrap((cb) => cb(), 'Mongodb instrumentation context preservation');
                } else {
                    return (cb) => cb();
                }
            }
        }
    });
    const eventMap = {}
    listener.on('started', function (event) {
        if (eventMap[event.requestId]) {
            // Note: Mongo can generate 2 completely separate requests
            // which share the same requestId, if a certain race condition is triggered.
            // For now, we accept that this can happen and potentially miss or mislabel some events.
            return;
        }
        eventMap[event.requestId] = event;
    });

    listener.on('succeeded', function (event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }
        event.operationId(() => channel.publish('mongodb', {startedData, event, succeeded: true}));
    });

    listener.on('failed', function (event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }
        event.operationId(() => channel.publish('mongodb', {startedData, event, succeeded: false}));
    });
    
    return originalMongo;
}

export const mongo2: IModulePatcher = {
    versionSpecifier: '>= 2.0.0 <= 2.3.0',
    patch: mongodbPatchFunction
}
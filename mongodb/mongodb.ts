/// <reference path="../IReplacement.d.ts" />

import * as ApplicationInsights from 'applicationinsights';

const mongodbPatchFunction: PatchFunction = function (originalMongo) {
    if (!ApplicationInsights.wrapWithCorrelationContext) {
        return originalMongo;
    }

    const listener = originalMongo.instrument({
        operationIdGenerator: {
            next: function () {
                // provide a function to restore the current context
                return ApplicationInsights.wrapWithCorrelationContext((cb) => cb());
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
        let dbName = "unknown mongo db";
        if (eventMap[event.requestId]) {
            dbName = eventMap[event.requestId].databaseName;
            delete eventMap[event.requestId];
        }
        // TODO: expose this setting more naturally?
        if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
            event.operationId(() => {
                ApplicationInsights.client
                    .trackDependency(
                        dbName,
                        event.commandName,
                        event.duration,
                        true,
                        'mongodb');
            });
        }
    });
    listener.on('failed', function (event) {
        let dbName = "unknown mongo db";
        if (eventMap[event.requestId]) {
            dbName = eventMap[event.requestId].databaseName;
            delete eventMap[event.requestId];
        }
        if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
            event.operationId(() => {
                ApplicationInsights.client
                    .trackDependency(
                        dbName,
                        event.commandName,
                        event.duration,
                        false,
                        'mongodb');
                ApplicationInsights.client
                    .trackException(event.failure);
            });
        }
    });
    
    return originalMongo;
}

export const mongo2: IModulePatcher = {
    versionSpecifier: '>= 2.0.0 <= 2.3.0',
    patch: mongodbPatchFunction
}
/// <reference path="../IReplacement.d.ts" />

import {ApplicationInsights} from 'applicationinsights';

const mongodbPatchFunction: PatchFunction = function (originalMongo) {
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
        eventMap[event.requestId] = event;
    });

    listener.on('succeeded', function (event) {
        // TODO: expose this setting more naturally?
        if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
            event.operationId(() => {
                ApplicationInsights.client
                    .trackDependency(
                        eventMap[event.requestId].databaseName,
                        event.commandName,
                        event.duration,
                        true,
                        'mongodb');
            });
        }
        delete eventMap[event.requestId];
    });
    listener.on('failed', function (event) {
        if (ApplicationInsights._isDependencies && ApplicationInsights.client) {
            event.operationId(() => {
                ApplicationInsights.client
                    .trackDependency(
                        eventMap[event.requestId].databaseName,
                        event.commandName,
                        event.duration,
                        false,
                        'mongodb');
                ApplicationInsights.client
                    .trackException(event.failure);
            });
        }
        delete eventMap[event.requestId];
    });
}

export const mongo2: IModulePatcher = {
    versionSpecifier: '>= 2.0.0 <= 2.2.0',
    patch: mongodbPatchFunction
}
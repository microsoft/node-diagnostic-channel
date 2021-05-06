// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";

export interface IMongoData {
    startedData: {
        databaseName?: string;
        command?: any;
        time: Date;
    };
    event: {
        commandName?: string;
        duration?: number;
        failure?: string;
        reply?: any;
    };
    succeeded: boolean;
}

const mongodbPatchFunction: PatchFunction = function(originalMongo) {
    const listener = originalMongo.instrument({
        operationIdGenerator: {
            next: function() {
                return channel.bindToContext((cb) => cb());
            },
        },
    });
    const eventMap = {};
    listener.on("started", function(event) {
        if (eventMap[event.requestId]) {
            // Note: Mongo can generate 2 completely separate requests
            // which share the same requestId, if a certain race condition is triggered.
            // For now, we accept that this can happen and potentially miss or mislabel some events.
            return;
        }
        eventMap[event.requestId] = { ...event, time: new Date() } as IMongoData["startedData"];
    });

    listener.on("succeeded", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event.operationId === "function") {
            event.operationId(() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: true}));
        } else {
            // fallback -- correlation will not work here
            channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: true});
        }
    });

    listener.on("failed", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event.operationId === "function") {
            event.operationId(() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: false}));
        } else {
            // fallback -- correlation will not work here
            channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: false});
        }

    });

    return originalMongo;
};

const mongodb3PatchFunction: PatchFunction = function(originalMongo) {
    const listener = originalMongo.instrument();
    const eventMap = {};
    const contextMap = {};
    listener.on("started", function(event) {
        if (eventMap[event.requestId]) {
            // Note: Mongo can generate 2 completely separate requests
            // which share the same requestId, if a certain race condition is triggered.
            // For now, we accept that this can happen and potentially miss or mislabel some events.
            return;
        }
        contextMap[event.requestId] = channel.bindToContext((cb) => cb());
        eventMap[event.requestId] = { ...event, time: new Date() } as IMongoData["startedData"];
    });

    listener.on("succeeded", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event === "object" && typeof contextMap[event.requestId] === "function") {
            contextMap[event.requestId](() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: true}));
            delete contextMap[event.requestId];
        }
    });

    listener.on("failed", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event === "object" && typeof contextMap[event.requestId] === "function") {
            contextMap[event.requestId](() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: false}));
            delete contextMap[event.requestId];
        }
    });

    return originalMongo;
};

// In mongodb 3.3.0, mongodb-core was merged into mongodb, so the same patching
// can be used here. this.s.pool was changed to this.s.coreTopology.s.pool
const mongodbcorePatchFunction = function(originalMongo) {
    const originalConnect = originalMongo.Server.prototype.connect;
    originalMongo.Server.prototype.connect = function contextPreservingConnect() {
        const ret = originalConnect.apply(this, arguments);

        // Messages sent to mongo progress through a pool
        // This can result in context getting mixed between different responses
        // so we wrap the callbacks to restore appropriate state
        const originalWrite = this.s.coreTopology.s.pool.write;
        this.s.coreTopology.s.pool.write = function contextPreservingWrite() {
            const cbidx = typeof arguments[1] === "function" ? 1 : 2;
            if (typeof arguments[cbidx] === "function" ) {
                arguments[cbidx] = channel.bindToContext(arguments[cbidx]);
            }
            return originalWrite.apply(this, arguments);
        };

        // Logout is a special case, it doesn't call the write function but instead
        // directly calls into connection.write
        const originalLogout = this.s.coreTopology.s.pool.logout;
        this.s.coreTopology.s.pool.logout = function contextPreservingLogout() {
            if (typeof arguments[1] === "function") {
                arguments[1] = channel.bindToContext(arguments[1]);
            }
            return originalLogout.apply(this, arguments);
        };
        return ret;
    };

    return originalMongo;
};

const mongodb330PatchFunction: PatchFunction = function(originalMongo) {
    mongodbcorePatchFunction(originalMongo); // apply mongodb-core patches
    const listener = originalMongo.instrument();
    const eventMap = {};
    const contextMap = {};
    listener.on("started", function(event) {
        if (eventMap[event.requestId]) {
            // Note: Mongo can generate 2 completely separate requests
            // which share the same requestId, if a certain race condition is triggered.
            // For now, we accept that this can happen and potentially miss or mislabel some events.
            return;
        }
        contextMap[event.requestId] = channel.bindToContext((cb) => cb());
        eventMap[event.requestId] = event;
    });

    listener.on("succeeded", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event === "object" && typeof contextMap[event.requestId] === "function") {
            contextMap[event.requestId](() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: true}));
            delete contextMap[event.requestId];
        }
    });

    listener.on("failed", function(event) {
        const startedData = eventMap[event.requestId];
        if (startedData) {
            delete eventMap[event.requestId];
        }

        if (typeof event === "object" && typeof contextMap[event.requestId] === "function") {
            contextMap[event.requestId](() => channel.publish<IMongoData>("mongodb", {startedData, event, succeeded: false}));
            delete contextMap[event.requestId];
        }
    });

    return originalMongo;
};

export const mongo2: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 <= 3.0.5",
    patch: mongodbPatchFunction,
};
export const mongo3: IModulePatcher = {
    versionSpecifier: "> 3.0.5 < 3.3.0",
    patch: mongodb3PatchFunction,
};
export const mongo330: IModulePatcher = {
    versionSpecifier: ">= 3.3.0 < 4.0.0",
    patch: mongodb330PatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("mongodb", mongo2);
    channel.registerMonkeyPatch("mongodb", mongo3);
    channel.registerMonkeyPatch("mongodb", mongo330);
}

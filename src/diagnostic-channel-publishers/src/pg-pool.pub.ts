// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";
import {EventEmitter} from "events";

function postgresPool1PatchFunction(originalPgPool) {
    const originalConnect = originalPgPool.prototype.connect;

    originalPgPool.prototype.connect = function connect(callback?: Function): void {
        callback = callback
            ? channel.bindToContext(callback)
            : callback;

        originalConnect.apply(this, arguments);
    };

    return originalPgPool;
}

export const postgresPool1: IModulePatcher = {
    versionSpecifier: "1.x",
    patch: postgresPool1PatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("pg-pool", postgresPool1);
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";

const mongodbcorePatchFunction: PatchFunction = function(originalMongoCore) {
    const originalConnect = originalMongoCore.Server.prototype.connect;
    originalMongoCore.Server.prototype.connect = function contextPreservingConnect() {
        const ret = originalConnect.apply(this, arguments);

        // Messages sent to mongo progress through a pool
        // This can result in context getting mixed between different responses
        // so we wrap the callbacks to restore appropriate state
        const originalWrite = this.s.pool.write;
        this.s.pool.write = function contextPreservingWrite() {
            const cbidx = typeof arguments[1] === "function" ? 1 : 2;
            if (typeof arguments[cbidx] === "function" ) {
                arguments[cbidx] = channel.bindToContext(arguments[cbidx]);
            }
            return originalWrite.apply(this, arguments);
        };

        // Logout is a special case, it doesn't call the write function but instead
        // directly calls into connection.write
        const originalLogout = this.s.pool.logout;
        this.s.pool.logout = function contextPreservingLogout() {
            if (typeof arguments[1] === "function") {
                arguments[1] = channel.bindToContext(arguments[1]);
            }
            return originalLogout.apply(this, arguments);
        };
        return ret;
    };

    return originalMongoCore;
};

export const mongoCore: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 < 4.0.0",
    patch: mongodbcorePatchFunction
};

export function enable() {
    channel.registerMonkeyPatch("mongodb-core", mongoCore);
}

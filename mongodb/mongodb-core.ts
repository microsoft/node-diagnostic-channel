/// <reference path="../IReplacement.d.ts" />

// This is purely to preserve context
import {channel} from "../channel";

const mongodbcorePatchFunction : PatchFunction = function (originalMongoCore) {
    const originalConnect = originalMongoCore.Server.prototype.connect;
    originalMongoCore.Server.prototype.connect = function contextPreservingConnect() {
        const ret = originalConnect.apply(this, arguments);

        // Messages sent to mongo progress through a pool
        // This can result in context getting mixed between different responses
        // so we wrap the callbacks to restore appropriate state
        const originalWrite = this.s.pool.write;
        this.s.pool.write = function contextPreservingWrite() {
            const cbidx = typeof arguments[1] === 'function' ? 1 : 2;
            if (typeof arguments[cbidx] === 'function' ) {
                arguments[cbidx] = channel.bindToContext(arguments[cbidx]);
            }
            return originalWrite.apply(this, arguments);
        };

        // Logout is a special case, it doesn't call the write function but instead
        // directly calls into connection.write
        const originalLogout = this.s.pool.logout;
        this.s.pool.logout = function contextPreservingLogout() {
            if (typeof arguments[1] === 'function') {
                arguments[1] = channel.bindToContext(arguments[1]);
            }
            return originalLogout.apply(this, arguments);
        };
        return ret;
    }

    return originalMongoCore;
}

export const mongoCore2: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 <= 2.2.0",
    patch: mongodbcorePatchFunction
}
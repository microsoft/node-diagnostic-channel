/// <reference path="../IReplacement.d.ts" />

import {channel} from "../channel";

const redisPatchFunction : PatchFunction = (originalRedis) => {
    const originalSend = originalRedis.RedisClient.prototype.internal_send_command;

    // Note: This is mixing together both context tracking and dependency tracking
    originalRedis.RedisClient.prototype.internal_send_command = function (command_obj) {
        if (command_obj) {
            const cb = command_obj.callback;
            const address = this.address;
            const startTime = process.hrtime();

            let wrapFunction = channel.bindToContext;

            // Note: augmenting the callback on internal_send_command is correct for context
            // tracking, but may be too low-level for dependency tracking. There are some 'errors'
            // which higher levels expect in some cases
            // However, the only other option is to intercept every individual command.
            command_obj.callback = wrapFunction(function (err) {
                const hrDuration = process.hrtime(startTime);
                const duration = (hrDuration[0] * 1e3 + hrDuration[1]/1e6)|0;
                channel.publish('redis', {duration, address, command_obj, err});

                if (typeof cb === 'function') {
                    cb.apply(this, arguments);
                }
            });
        }

        originalSend.call(this, command_obj);
    }

    return originalRedis;
}

export const redis: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 < 3.0.0",
    patch: redisPatchFunction
};

channel.registerMonkeyPatch('redis', redis);
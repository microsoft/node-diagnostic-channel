// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "pubsub-channel";

export interface IRedisData {
    duration: number;
    address: string;
    commandObj: any;
    err: Error;
    result: any;
}

const redisPatchFunction: PatchFunction = (originalRedis) => {
    const originalSend = originalRedis.RedisClient.prototype.internal_send_command;

    // Note: This is mixing together both context tracking and dependency tracking
    originalRedis.RedisClient.prototype.internal_send_command = function(commandObj) {
        if (commandObj) {
            const cb = commandObj.callback;
            if (!cb.pubsubBound) {
                const address = this.address;
                const startTime = process.hrtime();

                // Note: augmenting the callback on internal_send_command is correct for context
                // tracking, but may be too low-level for dependency tracking. There are some 'errors'
                // which higher levels expect in some cases
                // However, the only other option is to intercept every individual command.
                commandObj.callback = channel.bindToContext(function(err, result) {
                    const hrDuration = process.hrtime(startTime);
                    /* tslint:disable-next-line:no-bitwise */
                    const duration = (hrDuration[0] * 1e3 + hrDuration[1] / 1e6) | 0;
                    channel.publish<IRedisData>("redis", {duration, address, commandObj, err, result});

                    if (typeof cb === "function") {
                        cb.apply(this, arguments);
                    }
                });
                commandObj.callback.pubsubBound = true;
            }
        }

        return originalSend.call(this, commandObj);
    };

    return originalRedis;
};

export const redis: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 < 3.0.0",
    patch: redisPatchFunction,
};

channel.registerMonkeyPatch("redis", redis);

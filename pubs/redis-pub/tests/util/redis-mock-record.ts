// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {PatchFunction} from "pubsub-channel";


export const redisCommunication = [];

export const redisConnectionRecordPatchFunction : PatchFunction = function (originalRedis) {
    const ocreate_stream = originalRedis.RedisClient.prototype.create_stream;
    originalRedis.RedisClient.prototype.create_stream = function () {
        const ret = ocreate_stream.apply(this, arguments);
        this.stream.prependListener("data", function (data) {
            redisCommunication.push({recv: data});
        });
        this.stream.on("drain", function (data) {
            redisCommunication.push({drain: {data}});
        })

        const oStreamWrite = this.stream.write;
        this.stream.write = function (data) {
            const ret = oStreamWrite.apply(this, arguments);
            redisCommunication.push({send: data, ret})
            return ret;
        }

        return ret;
    }

    return originalRedis;
}
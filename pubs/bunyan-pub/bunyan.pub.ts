// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, PatchFunction, IModulePatcher} from "pubsub-channel";

const bunyanPatchFunction : PatchFunction = (originalBunyan) => {
    const originalEmit = originalBunyan.prototype._emit;

    originalBunyan.prototype._emit = function (rec, noemit) {
        const ret = originalEmit.apply(this, arguments);
        if (!noemit) {
            let str = ret;
            if (!str) {
                str = originalEmit.call(this, rec, true);
            }
            channel.publish('bunyan', {level: rec.level, result:str});
        }
        return ret;
    }

    return originalBunyan;
}

export const bunyan: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: bunyanPatchFunction
};

channel.registerMonkeyPatch('bunyan', bunyan);
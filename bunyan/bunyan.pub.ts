/// <reference path="../IReplacement.d.ts" />

import {channel} from "../channel";

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
}
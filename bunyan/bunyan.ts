/// <reference path="../IReplacement.d.ts" />

import * as ApplicationInsights from "applicationinsights";
import {SeverityLevel} from "applicationinsights/Library/Contracts";

const bunyanPatchFunction : PatchFunction = (originalBunyan) => {
    const originalEmit = originalBunyan.prototype._emit;

    const bunyanToAILevelMap = {};
    bunyanToAILevelMap[originalBunyan.TRACE] = SeverityLevel.Verbose;
    bunyanToAILevelMap[originalBunyan.DEBUG] = SeverityLevel.Verbose;
    bunyanToAILevelMap[originalBunyan.INFO] = SeverityLevel.Information;
    bunyanToAILevelMap[originalBunyan.WARN] = SeverityLevel.Warning;
    bunyanToAILevelMap[originalBunyan.ERROR] = SeverityLevel.Error;
    bunyanToAILevelMap[originalBunyan.FATAL] = SeverityLevel.Critical;

    originalBunyan.prototype._emit = function (rec, noemit) {
        const ret = originalEmit.apply(this, arguments);
        if (!noemit && ApplicationInsights.client) {
            let str = ret;
            if (!str) {
                str = originalEmit.call(this, rec, true);
            }
            const level = bunyanToAILevelMap[rec.level]
            ApplicationInsights.client.trackTrace(str, level)
        }
        return ret;
    }

    return originalBunyan;
}

export const bunyan: IModulePatcher = {
    versionSpecifier: ">= 1.0.0 < 2.0.0",
    patch: bunyanPatchFunction
}
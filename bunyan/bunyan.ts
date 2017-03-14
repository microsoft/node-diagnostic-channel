/// <reference path="../IReplacement.d.ts" />

import * as ApplicationInsights from "applicationinsights";
import {Contracts} from "applicationinsights/Library/Contracts";

const bunyanPatchFunction : PatchFunction = (originalBunyan) => {
    const originalEmit = originalBunyan.prototype._emit;

    const bunyanToAILevelMap = {};
    bunyanToAILevelMap[originalBunyan.TRACE] = Contracts.SeverityLevel.Verbose;
    bunyanToAILevelMap[originalBunyan.DEBUG] = Contracts.SeverityLevel.Verbose;
    bunyanToAILevelMap[originalBunyan.INFO] = Contracts.SeverityLevel.Information;
    bunyanToAILevelMap[originalBunyan.WARN] = Contracts.SeverityLevel.Warning;
    bunyanToAILevelMap[originalBunyan.ERROR] = Contracts.SeverityLevel.Error;
    bunyanToAILevelMap[originalBunyan.FATAL] = Contracts.SeverityLevel.Critical;

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
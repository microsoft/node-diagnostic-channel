/// <reference path="../IReplacement.d.ts" />

import * as ApplicationInsights from "applicationinsights";
import * as path from "path";

const mysqlPatchFunction : PatchFunction = function (originalMysql, originalMysqlPath) {
    if (!ApplicationInsights.wrapWithCorrelationContext) {
        return originalMysql;
    }

    const patchClassFunction = (classObject) => {
        return (func) => {
            const originalFunc = classObject.prototype[func];
            if (originalFunc) {
                classObject.prototype[func] = function () {
                    const cb = arguments[arguments.length -1];
                    if (typeof cb === 'function') {
                        arguments[arguments.length -1] = ApplicationInsights.wrapWithCorrelationContext(cb);
                    }
                    return originalFunc.apply(this,arguments);
                }
            }
        }
    }

    const connectionCallbackFunctions = [
        'createQuery', 'connect', 'changeUser',
        'ping', 'statistics', 'end'
    ];

    const connectionClass = require(`${originalMysqlPath}/lib/Connection`);
    connectionCallbackFunctions.forEach(patchClassFunction(connectionClass));
    
    const poolCallbackFunctions = [
        '_enqueueCallback'
    ];
    const poolClass = require(`${originalMysqlPath}/lib/Pool`);

    poolCallbackFunctions.forEach(patchClassFunction(poolClass));

    return originalMysql;
}

export const mysql: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 <= 2.14.0",
    patch: mysqlPatchFunction
};

/// <reference path="../IReplacement.d.ts" />

import {channel} from "../channel";
import * as path from "path";

const mysqlPatchFunction : PatchFunction = function (originalMysql, originalMysqlPath) {
    const patchObjectFunction = (obj, name) => {
        return (func) => {
            const originalFunc = obj[func];
            if (originalFunc) {
                obj[func] = function () {
                    let cbidx = arguments.length -1;
                    for(let i = arguments.length -1; i >= 0; --i) {
                        if (typeof arguments[i] === 'function') {
                            cbidx = i;
                            break;
                        } else if (typeof arguments[i] !== 'undefined') {
                            break;
                        }
                    }
                    const cb = arguments[cbidx];
                    if (typeof cb === 'function') {
                        arguments[cbidx] = channel.bindToContext(cb);
                    }
                    return originalFunc.apply(this,arguments);
                }
            }
        }

    }

    const patchClassMemberFunction = (classObject, name) => {
        return patchObjectFunction(classObject.prototype, `${name}.prototype`);
    }

    const connectionCallbackFunctions = [
        'connect', 'changeUser',
        'ping', 'statistics', 'end'
    ];

    const connectionClass = require(`${path.dirname(originalMysqlPath)}/lib/Connection`);
    connectionCallbackFunctions.forEach(patchClassMemberFunction(connectionClass, 'Connection'));
    patchObjectFunction(connectionClass, 'Connection')('createQuery'); // Static method
    
    const poolCallbackFunctions = [
        '_enqueueCallback'
    ];
    const poolClass = require(`${path.dirname(originalMysqlPath)}/lib/Pool`);

    poolCallbackFunctions.forEach(patchClassMemberFunction(poolClass, 'Pool'));

    // TODO: determine which events to publish

    return originalMysql;
}

export const mysql: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 <= 2.14.0",
    patch: mysqlPatchFunction
};

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, PatchFunction, IModulePatcher} from "pubsub-channel";
import * as path from "path";

const mysqlPatchFunction : PatchFunction = function (originalMysql, originalMysqlPath) {
    const patchObjectFunction = (obj: any, name: string) => {
        return (func, cbWrapper?: (resultContainer: {result: any, startTime: [number, number]}, cb: Function) => Function) => {
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
                    
                    let resultContainer = {result: null, startTime: null};
                    if (typeof cb === 'function') {
                        if (cbWrapper) {
                            resultContainer.startTime = process.hrtime();
                            arguments[cbidx] = channel.bindToContext(cbWrapper(resultContainer, cb));
                        } else {
                            arguments[cbidx] = channel.bindToContext(cb);
                        }
                    }
                    const result = originalFunc.apply(this,arguments);
                    resultContainer.result = result;
                    return result;
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
    connectionCallbackFunctions.forEach((value) => patchClassMemberFunction(connectionClass, 'Connection')(value));
    patchObjectFunction(connectionClass, 'Connection')('createQuery', (resultContainer, cb) => {
        return function (err) {
            const hrDuration = process.hrtime(resultContainer.startTime);
            const duration = (hrDuration[0] * 1e3 + hrDuration[1]/1e6)|0; 
            channel.publish('mysql', {query: resultContainer.result, callbackArgs: arguments, err, duration});
            cb.apply(this, arguments);
        }
    }); // Static method
    
    const poolCallbackFunctions = [
        '_enqueueCallback'
    ];
    const poolClass = require(`${path.dirname(originalMysqlPath)}/lib/Pool`);

    poolCallbackFunctions.forEach((value) => patchClassMemberFunction(poolClass, 'Pool')(value));

    return originalMysql;
}

export const mysql: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 <= 2.14.0",
    patch: mysqlPatchFunction
};

channel.registerMonkeyPatch('mysql', mysql);
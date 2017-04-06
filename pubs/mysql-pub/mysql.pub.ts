// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as path from "path";
import {channel, IModulePatcher, PatchFunction} from "pubsub-channel";

interface IResultContainer {
    result: any;
    startTime: [number, number];
}
/* tslint:disable-next-line:ban-types */
type CallbackWrapper<T extends Function> = (resultContainer: IResultContainer, cb: T) => T;

export interface IMysqlData {
    query: {
        sql?: string,
        _connection?: {
            config?: {
                socketPath?: string,
                host?: string,
                port?: number,
            },
        },
    };
    callbackArgs: IArguments;
    err: Error;
    duration: number;
}

const mysqlPatchFunction: PatchFunction = function(originalMysql, originalMysqlPath) {
    // The `name` passed in here is for debugging purposes,
    // to help distinguish which object is being patched.
    const patchObjectFunction = (obj: any, name: string) => {
        /* tslint:disable-next-line:ban-types */
        return <T extends Function>(func, cbWrapper?: CallbackWrapper<T>) => {
            const originalFunc = obj[func];
            if (originalFunc) {
                obj[func] = function mysqlContextPreserver() {
                    // Find the callback, if there is one
                    let cbidx = arguments.length - 1;
                    for (let i = arguments.length - 1; i >= 0; --i) {
                        if (typeof arguments[i] === "function") {
                            cbidx = i;
                            break;
                        } else if (typeof arguments[i] !== "undefined") {
                            break;
                        }
                    }
                    const cb = arguments[cbidx];

                    const resultContainer = {result: null, startTime: null};
                    if (typeof cb === "function") {
                        // Preserve context on the callback.
                        // If this is one of the functions that we want to track,
                        // then wrap the callback with the tracking wrapper
                        if (cbWrapper) {
                            resultContainer.startTime = process.hrtime();
                            arguments[cbidx] = channel.bindToContext(cbWrapper(resultContainer, cb));
                        } else {
                            arguments[cbidx] = channel.bindToContext(cb);
                        }
                    }
                    const result = originalFunc.apply(this, arguments);
                    resultContainer.result = result;
                    return result;
                };
            }
        };

    };

    const patchClassMemberFunction = (classObject, name) => {
        return patchObjectFunction(classObject.prototype, `${name}.prototype`);
    };

    const connectionCallbackFunctions = [
        "connect", "changeUser",
        "ping", "statistics", "end",
    ];

    const connectionClass = require(`${path.dirname(originalMysqlPath)}/lib/Connection`);
    connectionCallbackFunctions.forEach((value) => patchClassMemberFunction(connectionClass, "Connection")(value));

    // Connection.createQuery is a static method
    patchObjectFunction(connectionClass, "Connection")("createQuery", (resultContainer, cb) => {
        return function(err) {
            const hrDuration = process.hrtime(resultContainer.startTime);
            /* tslint:disable-next-line:no-bitwise */
            const duration = (hrDuration[0] * 1e3 + hrDuration[1] / 1e6) | 0;
            channel.publish<IMysqlData>("mysql", {query: resultContainer.result, callbackArgs: arguments, err, duration});
            cb.apply(this, arguments);
        };
    });

    const poolCallbackFunctions = [
        "_enqueueCallback",
    ];
    const poolClass = require(`${path.dirname(originalMysqlPath)}/lib/Pool`);

    poolCallbackFunctions.forEach((value) => patchClassMemberFunction(poolClass, "Pool")(value));

    return originalMysql;
};

export const mysql: IModulePatcher = {
    versionSpecifier: ">= 2.0.0 <= 2.14.0",
    patch: mysqlPatchFunction,
};

channel.registerMonkeyPatch("mysql", mysql);

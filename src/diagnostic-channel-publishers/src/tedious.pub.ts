// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";
import * as tediousTypes from 'tedious';

type CompletionCallback = (error: Error | null | undefined, rowCount?: number, rows?: any) => void;

export interface ITediousResult {
    rowCount: number;
    rows: any;
}

export interface ITediousData {
    query: {
        text?: string;
        plan?: string;
        preparable?: {
            text: string;
            args: any[];
        }
    };
    database: {
        host: string;
        port: string;
    };
    result?: ITediousResult;
    duration: number;
    error?: Error;
}

const tediousPatchFunction: PatchFunction = (originalTedious: typeof tediousTypes) => {
    const originalMakeRequest: Function = (originalTedious.Connection.prototype as any).makeRequest;
    (originalTedious.Connection.prototype as any).makeRequest = function makeRequest() {
        function getPatchedCallback(origCallback: CompletionCallback) {
            const start = process.hrtime();
            let data: ITediousData = {
                query: {},
                database: {
                    host: null,
                    port: null
                },
                result: null,
                error: null,
                duration: 0,
            };
            return channel.bindToContext(function(err: Error | null, rowCount?: number | null, rows?: any) {
                const end = process.hrtime(start);
                data = { ...data,
                    database: {
                        host: this.connection.config.server,
                        port: this.connection.config.options.port,
                    },
                    result: !err && { rowCount, rows },
                    query: {
                        text: this.parametersByName.statement.value
                    },
                    error: err,
                    duration: Math.ceil((end[0] * 1e3) + (end[1] / 1e6))
                };
                channel.publish<ITediousData>("tedious", data);
                origCallback.call(this, err, rowCount, rows);
            });
        }

        const request = arguments[0] as tediousTypes.Request & { callback: CompletionCallback };
        arguments[0].callback = getPatchedCallback(request.callback);
        originalMakeRequest.apply(this, arguments);
    }
    return originalTedious;
}


export const tedious: IModulePatcher = {
    versionSpecifier: "6.*",
    patch: tediousPatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("tedious", tedious);
}

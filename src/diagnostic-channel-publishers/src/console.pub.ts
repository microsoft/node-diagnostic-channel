// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";
import {Writable} from "stream";

export interface IConsoleData {
    message: string;
    stderr?: boolean;
}

const consolePatchFunction: PatchFunction = (originalConsole) => {
    const aiLoggingOutStream = new Writable();
    const aiLoggingErrStream = new Writable();

    // Default console is roughly equivalent to `new Console(process.stdout, process.stderr)`
    // We create a version which publishes to the channel and also to stdout/stderr
    aiLoggingOutStream.write = function(chunk: string | Buffer): boolean {
        if (!chunk) {
            return true;
        }
        const message = chunk.toString();

        channel.publish<IConsoleData>("console", {message});

        return true;
    };

    aiLoggingErrStream.write = function(chunk: string | Buffer): boolean {
        if (!chunk) {
            return true;
        }
        const message = chunk.toString();

        channel.publish<IConsoleData>("console", {message, stderr: true});

        return true;
    };

    const aiLoggingConsole: Console = new originalConsole.Console(aiLoggingOutStream, aiLoggingErrStream);

    const consoleMethods = ["log", "info", "warn", "error", "dir", "time", "timeEnd", "trace", "assert"];

    for (const method of consoleMethods) {
        const originalMethod = originalConsole[method];
        if (originalMethod) {
            originalConsole[method] = function() {
                if (aiLoggingConsole[method]) {
                    try {
                        aiLoggingConsole[method].apply(aiLoggingConsole, arguments);
                    } catch (e) {
                        // Ignore errors; allow the original method to throw if necessary
                    }
                }
                return originalMethod.apply(originalConsole, arguments);
            };
        }
    }

    return originalConsole;
};

export const console: IModulePatcher = {
    versionSpecifier: ">= 4.0.0",
    patch: consolePatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("console", console);

    // Force patching of console
    /* tslint:disable-next-line:no-var-requires */
    require("console");
}

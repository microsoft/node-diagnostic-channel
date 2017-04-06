// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "pubsub-channel";
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

        return process.stdout.write(chunk);
    };

    aiLoggingErrStream.write = function(chunk: string | Buffer): boolean {
        if (!chunk) {
            return true;
        }
        const message = chunk.toString();

        channel.publish<IConsoleData>("console", {message, stderr: true});

        return process.stderr.write(chunk);
    };

    const aiLoggingConsole: Console = new originalConsole.Console(aiLoggingOutStream, aiLoggingErrStream);
    aiLoggingConsole.Console = originalConsole.Console;

    const consolePropertyDescriptor = Object.getOwnPropertyDescriptor(global, "console");
    consolePropertyDescriptor.get = function() { return aiLoggingConsole; };
    Object.defineProperty(global, "console", consolePropertyDescriptor);

    return aiLoggingConsole;
};

export const console: IModulePatcher = {
    versionSpecifier: ">= 4.0.0",
    patch: consolePatchFunction,
};

channel.registerMonkeyPatch("console", console);

// Force patching of console
/* tslint:disable-next-line:no-var-requires */
require("console");

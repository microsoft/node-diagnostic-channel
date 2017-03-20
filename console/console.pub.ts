/// <reference path="../IReplacement.d.ts" />

import {Writable} from "stream";
import {channel} from "../channel";

const consolePatchFunction : PatchFunction = (originalConsole) => {
    const aiLoggingOutStream = new Writable();
    const aiLoggingErrStream = new Writable();

    // Default console is roughly equivalent to `new Console(process.stdout, process.stderr)`
    // We create a version which prints to both AI traces and to stdout/stderr
    aiLoggingOutStream.write = function (chunk : string | Buffer): boolean {
        if (!chunk) {
            return true;
        }
        const data = chunk.toString();

        // WARNING: If a subscriber invokes 'console.log' then this will trigger an infinite recursion
        channel.publish("console", {data: data})
                
        process.stdout.write(chunk);
        return true;
    }

    aiLoggingErrStream.write = function (chunk : string | Buffer): boolean {
        if (!chunk) {
            return true;
        }
        const data = chunk.toString();

        // WARNING: If a subscriber invokes 'console.log' then this will trigger an infinite recursion
        channel.publish("console", {data: data, stderr: true});

        process.stderr.write(chunk);
        return true;
    }

    const aiLoggingConsole : Console = new originalConsole.Console(aiLoggingOutStream, aiLoggingErrStream);
    aiLoggingConsole.Console = originalConsole.Console;

    const consolePropertyDescriptor = Object.getOwnPropertyDescriptor(global, 'console');
    consolePropertyDescriptor.get = function () { return aiLoggingConsole; };
    Object.defineProperty(global, 'console', consolePropertyDescriptor);

    return aiLoggingConsole;
}

export const console: IModulePatcher = {
    versionSpecifier: ">= 4.0.0",
    patch: consolePatchFunction
}
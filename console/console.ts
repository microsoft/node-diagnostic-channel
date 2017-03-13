/// <reference path="../IReplacement.d.ts" />

import * as ApplicationInsights from "applicationinsights";
import {SeverityLevel} from "applicationinsights/Library/Contracts";
import {Writable} from "stream";

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

        if (ApplicationInsights.client) {
            ApplicationInsights.client.trackTrace(data);
        }
        
        process.stdout.write(chunk);
        return true;
    }

    aiLoggingErrStream.write = function (chunk : string | Buffer): boolean {
        if (!chunk) {
            return true;
        }
        const data = chunk.toString();

        if (ApplicationInsights.client) {
            ApplicationInsights.client.trackTrace(data, SeverityLevel.Warning);
        }

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
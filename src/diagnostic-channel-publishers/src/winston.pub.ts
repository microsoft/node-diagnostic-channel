// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";

export interface IWinstonData {
    message: string;
    meta: any;
    level: string;
}

// register a "filter" with each logger that publishes the data about to be logged
const winstonPatchFunction: PatchFunction = (originalWinston) => {
    const originalConfigure = originalWinston.Logger.prototype.configure;
    const originalLog = originalWinston.Logger.prototype.log;
    const loggingFilter = (level, message, meta) => {
        channel.publish<IWinstonData>("winston", {level, message, meta});
        return message;
    };

    // whenever someone logs, ensure our filter comes last
    originalWinston.Logger.prototype.log = function log() {
        if (!this.filters || this.filters.length === 0) {
            this.filters = [loggingFilter];
        } else if (this.filters[this.filters.length - 1] !== loggingFilter) {
            this.filters = this.filters.filter((f) => f !== loggingFilter);
            this.filters.push(loggingFilter);
        }

        return originalLog.apply(this, arguments);
    };

    // patch the pre-created default logger
    // the default logger is created with no configuration other than a console transport
    originalWinston.configure({
        transports: [
            new originalWinston.transports.Console(),
        ],
    });

    return originalWinston;
};

export const winston: IModulePatcher = {
    versionSpecifier: "2.x",
    patch: winstonPatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("winston", winston);
}

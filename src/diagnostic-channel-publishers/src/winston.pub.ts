// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import {channel, IModulePatcher, PatchFunction} from "diagnostic-channel";

export interface IWinstonData {
    message: string;
    meta: any;
    level: string;
    levelKind: string;
}

// register a "filter" with each logger that publishes the data about to be logged
const winstonPatchFunction: PatchFunction = (originalWinston) => {
    const originalLog = originalWinston.Logger.prototype.log;
    let curLevels: any;

    const loggingFilter = (level, message, meta) => {
        let levelKind: string;
        if (curLevels === originalWinston.config.npm.levels) {
            levelKind = "npm";
        } else if (curLevels === originalWinston.config.syslog.levels) {
            levelKind = "syslog";
        } else {
            levelKind = "unknown";
        }
        channel.publish<IWinstonData>("winston", {level, message, meta, levelKind});
        return message;
    };

    // whenever someone logs, ensure our filter comes last
    originalWinston.Logger.prototype.log = function log() {
        curLevels = this.levels;
        if (!this.filters || this.filters.length === 0) {
            this.filters = [loggingFilter];
        } else if (this.filters[this.filters.length - 1] !== loggingFilter) {
            this.filters = this.filters.filter((f) => f !== loggingFilter);
            this.filters.push(loggingFilter);
        }

        return originalLog.apply(this, arguments);
    };

    return originalWinston;
};

export const winston: IModulePatcher = {
    versionSpecifier: "2.x",
    patch: winstonPatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("winston", winston);
}

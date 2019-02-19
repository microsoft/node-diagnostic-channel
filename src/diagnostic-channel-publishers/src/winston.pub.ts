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
const winston2PatchFunction: PatchFunction = (originalWinston) => {
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

const winston3PatchFunction: PatchFunction = (originalWinston) => {
    const Transport = require("winston-transport");

    const mapLevelToKind = (winston, level: string) => {
        let levelKind: string;
        if (winston.config.npm.levels[level] != null) {
            levelKind = "npm";
        } else if (winston.config.syslog.levels[level] != null) {
            levelKind = "syslog";
        } else {
            levelKind = "unknown";
        }
        return levelKind;
    };
    class AppInsightsTransport extends Transport {
        private winston;

        constructor(winston, opts?: any) {
            super(opts);
            this.winston = winston;
        }

        public log(info: any, callback: any) {
            const {message, level} = info;
            const levelKind = mapLevelToKind(this.winston, level);
            const meta = {};

            // Remark: This check might not be necessary since winston 3.x does not support
            // older node versions, but I think it should stay here so we aren't the reason winston breaks
            // for these users.
            if (typeof Symbol["for"] === "function") {
                // By default, meta is placed in {"0" : {some: "field", another: "field"}}
                // but "rewriters" move it to info.meta, so hack for this...
                const metaSearch = info.meta ? [info.meta] : undefined || info[Symbol["for"]("splat")];
                if (metaSearch) {
                    for (const key in metaSearch[0]) {
                        if (meta.hasOwnProperty) {
                            meta[key] = metaSearch[0][key];
                        }
                    }
                }
            }
            channel.publish<IWinstonData>("winston", {message, level, levelKind, meta});
            callback();
        }
    }

    // Patch this function
    function patchedConfigure() {
        // Grab highest sev logging level in case of custom logging levels
        const levels = arguments[0].levels || originalWinston.config.npm.levels;
        let lastLevel;
        for (const level in levels) {
            if (levels.hasOwnProperty(level)) {
                lastLevel = lastLevel === undefined || levels[level] > levels[lastLevel] ? level : lastLevel;
            }
        }
        this.add(new AppInsightsTransport(originalWinston, {level: lastLevel}));
    }

    const origCreate = originalWinston.createLogger;
    originalWinston.createLogger = function patchedCreate() {
        // Grab highest sev logging level in case of custom logging levels
        const levels = arguments[0].levels || originalWinston.config.npm.levels;
        let lastLevel;
        for (const level in levels) {
            if (levels.hasOwnProperty(level)) {
                lastLevel = lastLevel === undefined || levels[level] > levels[lastLevel] ? level : lastLevel;
            }
        }

        // Add custom app insights transport to the end
        // Remark: Configure is not available until after createLogger()
        // and the Logger prototype is not exported in winston 3.x, so
        // patch both createLogger and configure. Could also call configure
        // again after createLogger, but that would cause configure to be called
        // twice per create.
        const result = origCreate.apply(this, arguments);
        result.add(new AppInsightsTransport(originalWinston, {level: lastLevel}));

        const origConfigure = result.configure;
        result.configure = function() {
            origConfigure.apply(this, arguments);
            patchedConfigure.apply(this, arguments);
        };

        return result;
    };

    const origRootConfigure = originalWinston.createLogger;
    originalWinston.configure = function() {
        origRootConfigure.apply(this, arguments);
        patchedConfigure.apply(this, arguments);
    };

    originalWinston.add(new AppInsightsTransport(originalWinston));
    return originalWinston;
};

export const winston3: IModulePatcher = {
    versionSpecifier: "3.x",
    patch: winston3PatchFunction,
};

export const winston2: IModulePatcher = {
    versionSpecifier: "2.x",
    patch: winston2PatchFunction,
};

export function enable() {
    channel.registerMonkeyPatch("winston", winston2);
    channel.registerMonkeyPatch("winston", winston3);
}

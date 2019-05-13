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
    class AppInsightsTransport extends originalWinston.Transport {
        private winston;

        constructor(winston, opts?: any) {
            super(opts);
            this.winston = winston;
        }

        public log(info: any, callback: any) {
            // tslint:disable-next-line:prefer-const - try to obtain level from Symbol(level) afterwards
            let { message, level, meta, ...splat } = info;
            level = typeof Symbol["for"] === "function" ? info[Symbol["for"]("level")] : level; // Symbol(level) is uncolorized, so prefer getting it from here

            const levelKind = mapLevelToKind(this.winston, level);

            meta = meta || {}; // Winston _somtimes_ puts metadata inside meta, so start from here
            for (const key in splat) {
                if (splat.hasOwnProperty(key)) {
                    meta[key] = splat[key];
                }
            }

            channel.publish<IWinstonData>("winston", { message, level, levelKind, meta });
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

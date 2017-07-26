// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import {channel, IStandardEvent, makePatchingRequire} from "diagnostic-channel";

import {enable as enableWinston, IWinstonData} from "../src/winston.pub";

function compareWinstonData(actual: IWinstonData, expected: IWinstonData): void {
    assert(actual.message === expected.message, "messages are not equal");
    // meta is an object, but we can always use the same reference
    assert(actual.meta === expected.meta, "meta objects are not equal");
    assert(actual.level === expected.level, "levels are not equal");
}

describe("winston", () => {
    let winston;
    let actual: IWinstonData = null;
    const listener = (event: IStandardEvent<IWinstonData>) => {
        actual = event.data;
    };

    before(() => {
        enableWinston();
        winston = require("winston");
    });

    beforeEach(() => {
        channel.subscribe<IWinstonData>("winston", listener);
    });

    afterEach(() => {
        channel.unsubscribe<IWinstonData>("winston", listener);
        actual = null;
    });

    it("should intercept the default logger", () => {
        const expected: IWinstonData = {message: "should intercept the default logger", meta: {}, level: "info"};

        winston.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should intercept new loggers", () => {
        const expected: IWinstonData = {message: "should intercept a new logger", meta: {testing: "new loggers"}, level: "info"};

        const loggerWithoutFilter = new winston.Logger({
            transports: [new winston.transports.Console()],
        });
        loggerWithoutFilter.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should intercept loggers with pre-configured filters", () => {
        const expected: IWinstonData = {message: "unfiltered", meta: {testing: "new loggers"}, level: "info"};
        const filteredMessage = "filtered";

        const loggerWithFilter = new winston.Logger({
            filters: [
                (level, message, meta) => filteredMessage,
            ],
            transports: [new winston.transports.Console()],
        });
        loggerWithFilter.log("info", "unfiltered", expected.meta);
        expected.message = filteredMessage;
        compareWinstonData(actual, expected);
    });

    it("should always publish the most-filtered message", () => {
        const expected: IWinstonData = {message: "unfiltered", meta: {testing: "new loggers"}, level: "info"};

        const loggerWithFilter = new winston.Logger({
            filters: [
                (level, message, meta) => "kinda filtered",
            ],
            transports: [new winston.transports.Console()],
        });

        loggerWithFilter.filters.push(() => "more filtered");
        loggerWithFilter.log("info", "unfiltered", expected.meta);
        expected.message = "more filtered";
        compareWinstonData(actual, expected);

        loggerWithFilter.filters.push(() => "even more filtered");
        loggerWithFilter.log("info", "unfiltered", expected.meta);
        expected.message = "even more filtered";
        compareWinstonData(actual, expected);
    });
});

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

    before(() => {
        enableWinston();
        winston = require("winston");
    });

    afterEach(() => {
        (channel as any).reset();
    });

    it("should intercept the default logger", () => {
        let actual: IWinstonData = null;
        const expected: IWinstonData = {message: "should intercept the default logger", meta: {}, level: "info"};

        channel.subscribe<IWinstonData>("winston", (event) => {
            actual = event.data;
        });
        winston.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should intercept new loggers", () => {
        let actual: IWinstonData = null;
        const expected: IWinstonData = {message: "should intercept a new logger", meta: {testing: "new loggers"}, level: "info"};

        channel.subscribe<IWinstonData>("winston", (event) => {
            actual = event.data;
        });
        const loggerWithoutFilter = new winston.Logger({
            transports: [new winston.transports.Console()],
        });
        loggerWithoutFilter.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should intercept loggers with pre-configured filters", () => {
        let actual: IWinstonData = null;
        const expected: IWinstonData = {message: "unfiltered", meta: {testing: "new loggers"}, level: "info"};
        const filteredMessage = "filtered";

        channel.subscribe<IWinstonData>("winston", (event) => {
            actual = event.data;
        });
        const loggerWithFilter = new winston.Logger({
            filters: [
                (level, message, meta) => filteredMessage,
            ],
            transports: [new winston.transports.Console()],
        });
        loggerWithFilter.log("info", expected.message, expected.meta);
        expected.message = filteredMessage;
        compareWinstonData(actual, expected);
    });

    it("should always publish the most-filtered message", () => {
        let actual: IWinstonData = null;
        const expected: IWinstonData = {message: "unfiltered", meta: {testing: "new loggers"}, level: "info"};

        channel.subscribe<IWinstonData>("winston", (event) => {
            actual = event.data;
        });
        const loggerWithFilter = new winston.Logger({
            filters: [
                (level, message, meta) => "kinda filtered",
            ],
            transports: [new winston.transports.Console()],
        });

        loggerWithFilter.filters.push(() => "more filtered");
        loggerWithFilter.log("info", expected.message, expected.meta);
        expected.message = "more filtered";
        compareWinstonData(actual, expected);

        loggerWithFilter.filters.push(() => "even more filtered");
        loggerWithFilter.log("info", expected.message, expected.meta);
        expected.message = "even more filtered";
        compareWinstonData(actual, expected);
    });
});

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

        const logger = new winston.Logger({
            filters: [
                (level, message, meta) => filteredMessage,
            ],
            transports: [new winston.transports.Console()],
        });
        logger.log("info", "unfiltered", expected.meta);
        expected.message = filteredMessage;
        compareWinstonData(actual, expected);
    });

    it("should always publish the most-filtered, most-rewritten message", () => {
        const expected: IWinstonData = {message: "unfiltered", meta: {rewritten: 0}, level: "info"};

        const logger = new winston.Logger({
            filters: [
                (level, message, meta) => "kinda filtered",
            ],
            rewriters: [
                (level, message, meta) => { meta.rewritten = 1; return meta; },
            ],
            transports: [new winston.transports.Console()],
        });

        const rewritten2 = { rewritten: 2 };
        logger.filters.push(() => "more filtered");
        logger.rewriters.push((level, message, meta) => rewritten2);
        logger.log("info", "unfiltered", {});
        compareWinstonData(actual, {message: "more filtered", meta: rewritten2, level: "info"});

        const rewritten3 = { rewritten: 3 };
        logger.filters.push(() => "even more filtered");
        logger.rewriters.push((level, message, meta) => rewritten3);
        logger.log("info", "unfiltered", {});
        compareWinstonData(actual, {message: "even more filtered", meta: rewritten3, level: "info"});
    });
});

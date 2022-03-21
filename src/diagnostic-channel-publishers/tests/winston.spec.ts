// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
import * as assert from "assert";
import { channel, IStandardEvent } from "diagnostic-channel";

import { enable as enableWinston, IWinstonData } from "../src/winston.pub";

function compareWinstonData(actual: IWinstonData, expected: IWinstonData): void {
    assert.strictEqual(actual.message, expected.message, "messages are not equal");
    // // meta is an object, but we can always use the same reference
    assert.deepEqual(actual.meta, expected.meta, "meta objects are not equal");
    assert.strictEqual(actual.level, expected.level, "levels are not equal");
    assert.strictEqual(actual.levelKind, expected.levelKind, "level kinds are not equal");
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
        const expected: IWinstonData = { message: "should intercept the default logger", meta: {}, level: "info", levelKind: "npm" };

        winston.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should intercept new loggers", () => {
        const expected: IWinstonData = { message: "should intercept a new logger", meta: { testing: "new loggers", another: "meta field" }, level: "info", levelKind: "npm" };

        const loggerWithoutFilter = new winston.createLogger({
            transports: [new winston.transports.Console()]
        });
        loggerWithoutFilter.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should send Error message as Error instance", () => {
        const expected: IWinstonData = { message: new Error("a caught error"), meta: { foo: "bar" }, level: "info", levelKind: "npm" };

        const logger = new winston.createLogger({
            transports: [new winston.transports.Console()]
        });
        logger.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should send string message as string", () => {
        const expected: IWinstonData = { message: "test message", meta: { foo: "bar" }, level: "info", levelKind: "npm" };

        const logger = new winston.createLogger({
            transports: [new winston.transports.Console()]
        });
        logger.info(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should intercept loggers with pre-configured filters", () => {
        const expected: IWinstonData = { message: "unfiltered", meta: { testing: "new loggers", another: "meta field" }, level: "info", levelKind: "npm" };
        const filteredMessage = "filtered";
        const filterMessage = winston.format((info, opts) => {
            info.message = filteredMessage;
            return info;
        });

        const logger = new winston.createLogger({
            format: winston.format.combine(filterMessage(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        logger.log("info", "unfiltered", expected.meta);
        expected.message = filteredMessage;
        compareWinstonData(actual, expected);
    });

    it("should always publish the most-filtered, most-rewritten message", () => {
        const expected: IWinstonData = { message: "unfiltered", meta: { rewritten: 0 }, level: "info", levelKind: "npm" };
        const filterMessage = winston.format((info, opts) => {
            info.message = "filtered";
            return info;
        });
        const rewriter = winston.format((info, opts) => {
            info.meta = info.meta || {};
            info.meta.rewritten = 1;
            return info;
        });
        const logger = new winston.createLogger({
            format: winston.format.combine(filterMessage(), rewriter(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });

        const filterMessage2 = winston.format((info, opts) => {
            info.message = "more filtered";
            return info;
        });
        const rewriter2 = winston.format((info, opts) => {
            info.meta = info.meta || {};
            info.meta.rewritten = 2;
            return info;
        });
        logger.configure({
            format: winston.format.combine(filterMessage2(), rewriter2(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        logger.log("info", "unfiltered", {});
        compareWinstonData(actual, { message: "more filtered", meta: { rewritten: 2 }, level: "info", levelKind: "npm" });

        const filterMessage3 = winston.format((info, opts) => {
            info.message = "even more filtered";
            return info;
        });
        const rewriter3 = winston.format((info, opts) => {
            info.meta = info.meta || {};
            info.meta.rewritten = 3;
            return info;
        });
        logger.configure({
            format: winston.format.combine(filterMessage3(), rewriter3(), winston.format.json()),
            transports: [new winston.transports.Console()]
        });
        logger.log("info", "unfiltered", {});
        compareWinstonData(actual, { message: "even more filtered", meta: { rewritten: 3 }, level: "info", levelKind: "npm" });
    });

    it("should track correct metadata for child loggers", () => {
        const expected: IWinstonData = { message: "test message", level: "error", levelKind: "npm", meta: { some: "meta field", another: "metafield" } };
        const logger = new winston.createLogger({
            transports: [
                new winston.transports.Console()
            ]
        });

        const childLogger = logger.child({
            some: "meta field"
        });
        childLogger.error("test message", { another: "metafield" });

        compareWinstonData(actual, expected);
    });

    it("should get correct levelKind even if colorized", () => {
        const expected: IWinstonData = { message: "test message", level: "error", levelKind: "npm", meta: {} };
        const logger = new winston.createLogger({
            format: winston.format.combine(winston.format.colorize()),
            transports: [
                new winston.transports.Console()
            ]
        });

        logger.error("test message");
        compareWinstonData(actual, expected);
    });

    it("should track different syslog logging levels", () => {
        const expected: IWinstonData = { message: "should intercept the default logger", meta: {}, level: "info", levelKind: "npm" };
        const logger = new winston.createLogger({
            levels: winston.config.syslog.levels,
            transports: [
                new winston.transports.Console()
            ]
        });

        expected.levelKind = "syslog";
        expected.level = "warning";
        logger.log(expected.level, expected.message, expected.meta);
        compareWinstonData(actual, expected);

        expected.level = "alert";
        logger.alert(expected.message, expected.meta);
        compareWinstonData(actual, expected);
    });

    it("should not throw when createLogger is created without arguments", () => {
        assert.doesNotThrow(() => {
            const logger = new winston.createLogger();
            assert.ok(logger);
        });
    });

    it("should track custom logging levels", () => {
        const expected: IWinstonData = { message: "should intercept the default logger", meta: { some: "meta" }, level: "info", levelKind: "unknown" };

        const customLevels = {
            foo: 0,
            bar: 1,
            baz: 2,
            foobar: 3
        };

        const logger = winston.createLogger({
            levels: customLevels,
            transports: [
                new winston.transports.Console({
                    level: "foobar"
                })
            ]
        });

        for (const level in customLevels) {
            if (customLevels.hasOwnProperty) {
                expected.level = level;

                logger.log(level, expected.message, expected.meta);
                compareWinstonData(actual, expected);

                logger[level](expected.message, expected.meta);
                compareWinstonData(actual, expected);
            }
        }
    });
});

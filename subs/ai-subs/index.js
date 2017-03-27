// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
var bunyanSubscriber = require("bunyan-sub").subscriber;
var consoleSubscriber = require("console-sub").subscriber;
var mongodbSubscriber = require("mongodb-sub").subscriber;
var mysqlSubscriber = require("mysql-sub").subscriber;
var redisSubscriber = require("redis-sub").subscriber;

module.exports = {
    bunyanSubscriber,
    consoleSubscriber,
    mongodbSubscriber,
    mysqlSubscriber,
    redisSubscriber
};
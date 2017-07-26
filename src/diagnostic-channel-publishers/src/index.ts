// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as bunyan from "./bunyan.pub";
import * as consolePub from "./console.pub";
import * as mongodbCore from "./mongodb-core.pub";
import * as mongodb from "./mongodb.pub";
import * as mysql from "./mysql.pub";
import * as redis from "./redis.pub";
import * as winston from "./winston.pub";

export { bunyan, consolePub as console, mongodbCore, mongodb, mysql, redis, winston};

export function enable() {
    bunyan.enable();
    consolePub.enable();
    mongodbCore.enable();
    mongodb.enable();
    mysql.enable();
    redis.enable();
    winston.enable();
}

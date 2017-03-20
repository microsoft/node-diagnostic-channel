/// <reference path="./IReplacement.d.ts" />

import {mongoCore2} from './mongodb/mongodb-core';
import {mongo2} from './mongodb/mongodb.pub';
import {console} from './console/console.pub';
import {bunyan} from './bunyan/bunyan.pub';
import {redis} from './redis/redis.pub';
import {mysql} from './mysql/mysql.pub';

export interface IModulePatchMap {
    [key: string] : IModulePatcher[]
};
export const knownPatches : IModulePatchMap = {
    'bunyan': [
        bunyan
    ],
    'console': [
        console
    ],
    'mongodb-core': [
        mongoCore2
    ],
    'mongodb': [
        mongo2
    ],
    'redis': [
        redis
    ],
    'mysql': [
        mysql
    ]
}

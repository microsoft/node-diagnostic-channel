/// <reference path="./IReplacement.d.ts" />

import {mongoCore2} from './mongodb/mongodb-core';
import {mongo2} from './mongodb/mongodb';
import {console} from './console/console';
import {bunyan} from './bunyan/bunyan';
import {redis} from './redis/redis';

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
    ]
}

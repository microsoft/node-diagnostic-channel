
// For demo purposes, combine pub/sub into single module

import './bunyan/bunyan.sub';
import './console/console.sub';
import './mongodb/mongodb.sub';
import './mysql/mysql.sub';
import './redis/redis.sub';

import './bunyan/bunyan.pub';
import './console/console.pub';
import './mongodb/mongodb.pub';
import './mongodb/mongodb-core.pub';
import './mysql/mysql.pub';
import './redis/redis.pub';

// Also for demo purposes: hook up zone.js context preserving
// This is something that applicationinsights would do

declare var Zone;
import {channel} from './channel';
channel.addContextPreservation((cb) => {
    if (Zone && Zone.current) {
        return Zone.current.wrap(cb);
    };
    return cb;
})
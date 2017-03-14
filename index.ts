
import {knownPatches} from './knownPatches';
import {makePatchingRequire} from './patchRequire';

const moduleModule = require('module');
moduleModule.prototype.require = makePatchingRequire(knownPatches);

// Force patching of console
require('console');
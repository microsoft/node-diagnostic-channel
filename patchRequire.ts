
import * as semver from 'semver';
import * as path from 'path';

import {IModulePatchMap} from './knownPatches';

declare var process;

export function makePatchingRequire(knownPatches: IModulePatchMap) {

    const moduleModule = require('module');
    const nativeModules = Object.keys(process.binding('natives'));
    const originalRequire = moduleModule.prototype.require;

    const patchedModules : {[path: string]: any} = {};

    return function patchedRequire(moduleId: string): any {
        const originalModule = originalRequire.apply(this, arguments);
        if (knownPatches[moduleId]) {
            // Fetch the specific path of the module
            const modulePath = moduleModule._resolveFilename(moduleId, this);
        
            if (patchedModules.hasOwnProperty(modulePath)) {
                // This module has already been patched, no need to reapply
                return patchedModules[modulePath];
            }

            let moduleVersion: string;

            if (nativeModules.indexOf(moduleId) < 0) {
                try {
                    moduleVersion = originalRequire.call(this, path.join(moduleId, 'package.json')).version
                } catch (e) {
                    // This should only happen if moduleId is actually a path rather than a module
                    // This is not a supported scenario
                    return originalModule;
                }
            } else {
                // This module is implemented natively so we cannot find a package.json
                // Instead, take the version of node itself
                moduleVersion = process.version.substring(1);
            }
            const modulePatcher : IModulePatcher = knownPatches[moduleId].find((v) => semver.satisfies(moduleVersion, v.versionSpecifier))
            if (modulePatcher) {
                return patchedModules[modulePath] = modulePatcher.patch(originalModule);
            }
        }
        return originalModule;
    }
}
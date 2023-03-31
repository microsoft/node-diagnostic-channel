// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as semver from "semver";

import { channel } from "./channel";

export type PatchFunction = (module: any, path: string) => any;
export interface IModulePatcher {
    versionSpecifier: string;
    patch: PatchFunction;
    publisherName?: string;
}
export interface IModulePatchMap {
    [key: string]: IModulePatcher[];
}

declare const process;

/* tslint:disable-next-line:no-var-requires */
const moduleModule = require("module");
const nativeModules = Object.keys(process.binding("natives"));
const originalRequire = moduleModule.prototype.require;

export function makePatchingRequire(knownPatches: IModulePatchMap) {

    const patchedModules: { [path: string]: any } = {};

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
                    moduleVersion = originalRequire.call(this, path.join(moduleId, "package.json")).version;
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
            const prereleaseTagIndex = moduleVersion.indexOf("-");
            if (prereleaseTagIndex >= 0) {
                // We ignore prerelease tags to avoid impossible to fix gaps in support
                // e.g. supporting console in >= 4.0.0 would otherwise not include
                // 8.0.0-pre
                moduleVersion = moduleVersion.substring(0, prereleaseTagIndex);
            }

            let modifiedModule = originalModule;
            for (const modulePatcher of knownPatches[moduleId]) {
                if (semver.satisfies(moduleVersion, modulePatcher.versionSpecifier)) {
                    modifiedModule = modulePatcher.patch(modifiedModule, modulePath);
                    if (channel) {
                        const name = modulePatcher.publisherName || moduleId;
                        channel.addPatchedModule(name, moduleVersion);
                    }
                }
            }
            return patchedModules[modulePath] = modifiedModule;
        }
        return originalModule;
    };
}

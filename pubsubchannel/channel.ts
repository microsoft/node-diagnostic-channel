// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {makePatchingRequire, IModulePatchMap, IModulePatcher} from './patchRequire';

export {PatchFunction, IModulePatcher, makePatchingRequire} from './patchRequire';

export type ISubscriber = (event: any) => void;

class ContextPreservingEventEmitter {
    public version: string = require('./package.json').version; // Allow for future versions to replace things?
    private subscribers: {[key: string]: ISubscriber[]} = {};
    private contextPreservationFunction: (cb: Function) => Function = (cb) => cb;
    private knownPatches: IModulePatchMap = {};


    public publish(name: string, event: any): void {
        const listeners = this.subscribers[name];
        // Note: Listeners called synchronously to preserve context
        if (listeners) {
            listeners.forEach((l) => {
                try {
                    l(event)
                } catch (e) {
                    // Subscriber threw an error
                }
            });
        }
    }

    public subscribe(name: string, listener: ISubscriber): void {
        if (!this.subscribers[name]) {
            this.subscribers[name] = [];
        }

        this.subscribers[name].push(listener);
    }

    public unsubscribe(name: string, listener: ISubscriber): void {
        const listeners = this.subscribers[name];
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }

    // Used for tests
    public reset(): void {
        this.subscribers = {};
        this.contextPreservationFunction = (cb) => cb;

        // Modify the knownPatches object rather than replace, since a reference will be used in the 
        Object.getOwnPropertyNames(this.knownPatches).forEach((prop) => delete this.knownPatches[prop]);
    }

    public bindToContext(cb: Function) {
        return this.contextPreservationFunction(cb);
    }

    public addContextPreservation(preserver: (cb: Function) => Function) {
        const previousPreservationStack = this.contextPreservationFunction;
        this.contextPreservationFunction = (cb) => preserver(previousPreservationStack(cb));
    }

    public registerMonkeyPatch(packageName: string, patcher: IModulePatcher): void {
        if(!this.knownPatches[packageName]) {
            this.knownPatches[packageName] = [];
        }

        this.knownPatches[packageName].push(patcher);
    }

    public getPatchesObject(): IModulePatchMap {
        return this.knownPatches;
    }

    public autoLoadPackages(projectRoot: string): void {
        try {
            const packageJson = require(`${projectRoot}/package.json`);
            const dependencies = Object.keys(packageJson['dependencies']);
            dependencies.forEach((dep) => {
                try {
                    const depPackageJson = require(`${dep}/package.json`);
                    if (depPackageJson['pubsubAutoLoad']) {
                        require(dep);
                    }
                } catch (e) {
                    // Couldn't load this package
                    process.stderr.write("Failed to auto load " + dep);
                    process.stderr.write(e.toString());
                }
            })
        } catch (e) {
            // Couldn't auto load packages
            process.stderr.write("Failed to auto load packages");
            process.stderr.write(e.toString());
        }
    }
}

declare var global: {pubsubChannel: ContextPreservingEventEmitter};

if (!global.pubsubChannel) {
    global.pubsubChannel = new ContextPreservingEventEmitter();
    // TODO: should this only patch require after at least one monkey patch is registered?
    const moduleModule = require('module');
    // Note: We pass in the object now before any patches are registered, but the object 
    moduleModule.prototype.require = makePatchingRequire(global.pubsubChannel.getPatchesObject());
}

export const channel = global.pubsubChannel;
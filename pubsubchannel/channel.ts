// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {makePatchingRequire, IModulePatchMap, IModulePatcher} from './patchRequire';

export {PatchFunction, IModulePatcher, makePatchingRequire} from './patchRequire';

export interface IStandardEvent<T> {
    timestamp: number,
    data: T
}

export type ISubscriber<T> = (event: IStandardEvent<T>) => void;
export type IFilter = (publishing: boolean) => boolean;

interface IFilteredSubscriber<T> {
    listener: ISubscriber<T>,
    filter: IFilter
};

export interface IChannel {
    shouldPublish(name: string): boolean,
    publish<T>(name: string, event: T): void,
    subscribe<T>(name: string, listener: ISubscriber<T>, filter?: IFilter): void,
    unsubscribe<T>(name: string, listener: ISubscriber<T>, filter?: IFilter): void,

    bindToContext(cb: Function): Function,
    addContextPreservation(preserver: (cb: Function) => Function): void,

    registerMonkeyPatch(packageName: string, patcher: IModulePatcher): void

    autoLoadPackages(projectRoot: string): void
}


const trueFilter = (publishing: boolean) => true;

class ContextPreservingEventEmitter {
    public version: string = require('./package.json').version; // Allow for future versions to replace things?
    private subscribers: {[key: string]: IFilteredSubscriber<any>[]} = {};
    private contextPreservationFunction: (cb: Function) => Function = (cb) => cb;
    private knownPatches: IModulePatchMap = {};

    private currently_publishing: boolean = false;

    public shouldPublish(name: string): boolean {
        const listeners = this.subscribers[name];
        if (listeners) {
            return listeners.some(({filter}) => !filter || filter(false));
        }
        return false;
    }

    public publish<T>(name: string, event: T): void {
        if (this.currently_publishing) return; // Avoid reentrancy
        const listeners = this.subscribers[name];
        // Note: Listeners called synchronously to preserve context
        if (listeners) {
            const standardEvent = {
                timestamp: Date.now(),
                data: event
            };
            this.currently_publishing = true;
            listeners.forEach(({listener, filter}) => {
                try {
                    if (filter && filter(true)) {
                        listener(standardEvent)
                    }
                } catch (e) {
                    // Subscriber threw an error
                }
            });
            this.currently_publishing = false;
        }
    }

    public subscribe<T>(name: string, listener: ISubscriber<T>, filter: IFilter = trueFilter): void {
        if (!this.subscribers[name]) {
            this.subscribers[name] = [];
        }

        this.subscribers[name].push({listener, filter});
    }

    public unsubscribe<T>(name: string, listener: ISubscriber<T>, filter: IFilter = trueFilter): boolean {
        const listeners = this.subscribers[name];
        if (listeners) {
            for (let index = 0; index < listeners.length; ++index) {
                if (listeners[index].listener === listener && listeners[index].filter === filter) {
                    listeners.splice(index,1);
                    return true;
                }
            }
        }
        return false;
    }

    // Used for tests
    public reset(): void {
        this.subscribers = {};
        this.contextPreservationFunction = (cb) => cb;

        // Modify the knownPatches object rather than replace, since a reference will be used in the require patcher
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
    // Note: We pass in the object now before any patches are registered, but the object is passed by reference
    // so any updates made to the object will be visible in the patcher.
    moduleModule.prototype.require = makePatchingRequire(global.pubsubChannel.getPatchesObject());
}

export const channel: IChannel = global.pubsubChannel;
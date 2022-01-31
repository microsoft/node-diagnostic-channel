// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import { IModulePatcher, IModulePatchMap, makePatchingRequire } from "./patchRequire";

export { PatchFunction, IModulePatcher, makePatchingRequire } from "./patchRequire";

export interface ISpanContext {
    traceId: string;
    spanId: string;
    traceFlags?: string;
    tracestate?: string;
}

type ScopeManager = any;

export interface IStandardEvent<T> {
    timestamp: number;
    data: T;
}

export type ISubscriber<T> = (event: IStandardEvent<T>) => void;
export type IFilter = (publishing: boolean) => boolean;
export type IPatchedCallback = (moduleName: string, version: string) => void;

interface IFilteredSubscriber<T> {
    listener: ISubscriber<T>;
    filter: IFilter;
    patchCallback?: IPatchedCallback;
}

interface IPatchedModule {
    name: string;
    version: string;
}

export interface IChannel {
    shouldPublish(name: string): boolean;
    publish<T>(name: string, event: T): void;
    subscribe<T>(name: string, listener: ISubscriber<T>, filter?: IFilter, patchCallback?: IPatchedCallback): void;
    unsubscribe<T>(name: string, listener: ISubscriber<T>, filter?: IFilter): void;
    bindToContext<T extends Function>(cb: T): T;
    addContextPreservation<T extends Function>(preserver: (cb: T) => T): void;
    registerMonkeyPatch(packageName: string, patcher: IModulePatcher): void;
    getPatchesObject(): IModulePatchMap;
    addPatchedModule(moduleName: string, version: string): void;
}

export const trueFilter = (publishing: boolean) => true;

export class ContextPreservingEventEmitter implements IChannel {
    public version: string = require("./../../package.json").version; // Allow for future versions to replace things?
    public spanContextPropagator: ScopeManager;
    private subscribers: { [key: string]: Array<IFilteredSubscriber<any>> } = {};
    private contextPreservationFunction: <F extends Function>(cb: F) => F = (cb) => cb;
    private knownPatches: IModulePatchMap = {};
    public modulesPatched: IPatchedModule[] = [];

    private currentlyPublishing: boolean = false;

    public shouldPublish(name: string): boolean {
        const listeners = this.subscribers[name];
        if (listeners) {
            return listeners.some(({ filter }) => !filter || filter(false));
        }
        return false;
    }

    public publish<T>(name: string, event: T): void {
        if (this.currentlyPublishing) {
            return; // Avoid reentrancy
        }
        const listeners = this.subscribers[name];
        // Note: Listeners called synchronously to preserve context
        if (listeners) {
            const standardEvent = {
                timestamp: Date.now(),
                data: event,
            };
            this.currentlyPublishing = true;
            listeners.forEach(({ listener, filter }) => {
                try {
                    if (filter && filter(true)) {
                        listener(standardEvent);
                    }
                } catch (e) {
                    // Subscriber threw an error
                }
            });
            this.currentlyPublishing = false;
        }
    }

    public subscribe<T>(name: string, listener: ISubscriber<T>, filter: IFilter = trueFilter, patchCallback?: IPatchedCallback): void {
        if (!this.subscribers[name]) {
            this.subscribers[name] = [];
        }

        this.subscribers[name].push({ listener, filter, patchCallback });
        const patched = this.checkIfModuleIsAlreadyPatched(name);
        if (patched && patchCallback) {
            patchCallback(patched.name, patched.version);
        }
    }

    public unsubscribe<T>(name: string, listener: ISubscriber<T>, filter: IFilter = trueFilter): boolean {
        const listeners = this.subscribers[name];
        if (listeners) {
            for (let index = 0; index < listeners.length; ++index) {
                if (listeners[index].listener === listener && listeners[index].filter === filter) {
                    listeners.splice(index, 1);
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

    public bindToContext<T extends Function>(cb: T): T {
        return this.contextPreservationFunction(cb);
    }

    public addContextPreservation<T extends Function>(preserver: (cb: T) => T) {
        const previousPreservationStack = this.contextPreservationFunction;
        this.contextPreservationFunction = ((cb: T) => preserver(previousPreservationStack(cb))) as any;
    }

    public registerMonkeyPatch(packageName: string, patcher: IModulePatcher): void {
        if (!this.knownPatches[packageName]) {
            this.knownPatches[packageName] = [];
        }

        this.knownPatches[packageName].push(patcher);
    }

    public getPatchesObject(): IModulePatchMap {
        return this.knownPatches;
    }

    public addPatchedModule(name: string, version: string): void {
        for (const module of this.modulesPatched) {
            if (module.name === name) {
                return;
            }
        }
        // If new patch notify listeners
        this.modulesPatched.push({ name, version });
        const listeners = this.subscribers[name];
        if (listeners) {
            listeners.forEach((listener) => {
                if (listener.patchCallback) {
                    listener.patchCallback(name, version);
                }
            });
        }
    }

    private checkIfModuleIsAlreadyPatched(name: string): IPatchedModule | null {
        for (const module of this.modulesPatched) {
            if (module.name === name) {
                return module;
            }
        }
        return null;
    }
}

declare const global: { diagnosticsSource: ContextPreservingEventEmitter };

if (!global.diagnosticsSource) {
    global.diagnosticsSource = new ContextPreservingEventEmitter();
    // TODO: should this only patch require after at least one monkey patch is registered?
    /* tslint:disable-next-line:no-var-requires */
    const moduleModule = require("module");

    // Note: We pass in the object now before any patches are registered, but the object is passed by reference
    // so any updates made to the object will be visible in the patcher.
    moduleModule.prototype.require = makePatchingRequire(global.diagnosticsSource.getPatchesObject());
}

export const channel: IChannel = global.diagnosticsSource;

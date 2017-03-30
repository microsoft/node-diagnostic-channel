import { IModulePatcher } from './patchRequire';
export { PatchFunction, IModulePatcher, makePatchingRequire } from './patchRequire';
export interface IStandardEvent<T> {
    timestamp: number;
    data: T;
}
export declare type ISubscriber<T> = (event: IStandardEvent<T>) => void;
export declare type IFilter = (publishing: boolean) => boolean;
export interface IChannel {
    shouldPublish(name: string): boolean;
    publish<T>(name: string, event: T): void;
    subscribe<T>(name: string, listener: ISubscriber<T>, filter?: IFilter): void;
    unsubscribe<T>(name: string, listener: ISubscriber<T>, filter?: IFilter): void;
    bindToContext(cb: Function): Function;
    addContextPreservation(preserver: (cb: Function) => Function): void;
    registerMonkeyPatch(packageName: string, patcher: IModulePatcher): void;
    autoLoadPackages(projectRoot: string): void;
}
export declare const channel: IChannel;

export declare type PatchFunction = (any, path: string) => any;
export interface IModulePatcher {
    versionSpecifier: string;
    patch: PatchFunction;
}
export interface IModulePatchMap {
    [key: string]: IModulePatcher[];
}
export declare function makePatchingRequire(knownPatches: IModulePatchMap): (moduleId: string) => any;

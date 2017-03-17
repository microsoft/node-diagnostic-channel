
type PatchFunction = (any, path: string) => any;
interface IModulePatcher {
    versionSpecifier: string,
    patch: PatchFunction
}
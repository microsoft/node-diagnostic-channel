
type PatchFunction = (any) => any;
interface IModulePatcher {
    versionSpecifier: string,
    patch: PatchFunction
}
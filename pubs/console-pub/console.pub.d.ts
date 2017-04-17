import { IModulePatcher } from "diagnosticssource";
export interface IConsoleData {
    message: string;
    stderr?: boolean;
}
export declare const console: IModulePatcher;

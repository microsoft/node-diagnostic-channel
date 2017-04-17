import { IModulePatcher } from "diagnosticsource";
export interface IConsoleData {
    message: string;
    stderr?: boolean;
}
export declare const console: IModulePatcher;

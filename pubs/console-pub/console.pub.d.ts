import { IModulePatcher } from "pubsub-channel";
export interface IConsoleData {
    message: string;
    stderr?: boolean;
}
export declare const console: IModulePatcher;

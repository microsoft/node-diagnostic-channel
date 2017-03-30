import { IModulePatcher } from "pubsub-channel";
export declare type ConsoleData = {
    message: string;
    stderr?: boolean;
};
export declare const console: IModulePatcher;

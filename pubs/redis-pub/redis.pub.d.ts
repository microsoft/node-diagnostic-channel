import { IModulePatcher } from "pubsub-channel";
export interface IRedisData {
    duration: number;
    address: string;
    commandObj: any;
    err: Error;
    result: any;
}
export declare const redis: IModulePatcher;

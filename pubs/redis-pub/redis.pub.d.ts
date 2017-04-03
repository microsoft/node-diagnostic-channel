import { IModulePatcher } from "pubsub-channel";
export declare type RedisData = {
    duration: number;
    address: string;
    command_obj: any;
    err: Error;
    result: any;
};
export declare const redis: IModulePatcher;

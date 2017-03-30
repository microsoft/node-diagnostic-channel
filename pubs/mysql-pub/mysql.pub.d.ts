import { IModulePatcher } from "pubsub-channel";
export declare type MysqlData = {
    query: {
        sql?: string;
        _connection?: {
            config?: {
                socketPath?: string;
                host?: string;
                port?: number;
            };
        };
    };
    callbackArgs: IArguments;
    err: Error;
    duration: number;
};
export declare const mysql: IModulePatcher;

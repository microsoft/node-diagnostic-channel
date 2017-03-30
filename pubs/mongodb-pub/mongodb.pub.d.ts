import { IModulePatcher } from "pubsub-channel";
export declare type MongoData = {
    startedData: {
        databaseName?: string;
        command?: any;
    };
    event: {
        commandName?: string;
        duration?: number;
        failure?: string;
        reply?: any;
    };
    succeeded: boolean;
};
export declare const mongo2: IModulePatcher;

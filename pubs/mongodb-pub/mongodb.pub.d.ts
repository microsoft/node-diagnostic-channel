import { IModulePatcher } from "pubsub-channel";
export declare type MongoData = {
    startedData: {
        databaseName?: string;
    };
    event: {
        commandName?: string;
        duration?: number;
        failure?: string;
    };
    succeeded: boolean;
};
export declare const mongo2: IModulePatcher;

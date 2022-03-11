export default class DbMigrate {
    private dbPool;
    private filesPath;
    constructor(connectionSettings: DbMigrateConnectionSettings);
    setMigrationPath(path: string): void;
    migrate(): Promise<void>;
}
export declare class DbMigrateLogger {
    static log(content: string): void;
}
export interface DbMigrateConnectionSettings {
    host: string;
    username: string;
    password: string;
    database: string;
    port?: number;
    connectionLimit?: number;
    timezone?: string;
}

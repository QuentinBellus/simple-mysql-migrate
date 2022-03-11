export default class DbMigrate {
    private dbPool;
    constructor(connectionSettings: DbMigrateConnectionSettings);
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

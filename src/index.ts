import mysql from 'mysql2';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default class DbMigrate {

     private dbPool: any;
     private filesPath: string = "";

     public constructor(connectionSettings: DbMigrateConnectionSettings){
        this.dbPool = mysql.createPool({
            host: connectionSettings.host,
            user: connectionSettings.username,
            password: connectionSettings.password,
            database: connectionSettings.database,
            timezone: connectionSettings.timezone?connectionSettings.timezone:'+00:00',
            port: connectionSettings.port?connectionSettings.port:3306,
            connectionLimit: connectionSettings.connectionLimit?connectionSettings.connectionLimit:50,
        });
     }

     public setMigrationPath(path: string){
         if (!fs.existsSync(path)){
             throw new Error("Migration path is not valid");
         }
         this.filesPath = path;
     }

     public async migrate(){
        const computerName = os.hostname()
        // Checking our schema table exists
        const [tables]: [any[], any] = await this.dbPool.promise().query("SHOW TABLES LIKE 'schema_version'");
        if (tables.length == 0){
            DbMigrateLogger.log("Schema Version table not found, creating...");
            await this.dbPool.promise().query("CREATE TABLE `schema_version` (`revision` int(10) unsigned NOT NULL AUTO_INCREMENT,`version` varchar(255) DEFAULT NULL,`description` varchar(255) DEFAULT NULL,`type` enum('SQL','Node.js') DEFAULT NULL,`script` varchar(255) DEFAULT NULL,`checksum` int(11) DEFAULT NULL,`installed_rank` int(11) DEFAULT NULL,`installed_by` varchar(255) DEFAULT NULL,`installation_time` datetime DEFAULT NULL,`execution_time` int(11) DEFAULT NULL,`status` int(11) DEFAULT NULL,`reason` text DEFAULT NULL,PRIMARY KEY (`revision`)) ENGINE=InnoDB DEFAULT CHARSET=utf8");
            DbMigrateLogger.log("Schema Version table has been created");
        }

        let list: any[] = []; 
        fs.readdirSync(this.filesPath).forEach(file => {
            const match = file.match(/v([0-9\.]+)\_\_(.*)\.sql/i);
            if (match){
                const script = file;
                const version = match[1];
                const description = match[2].replace(/[_]/g,' ');
                list.push({
                    script: script,
                    version: version,
                    description: description,
                    fullpath: this.filesPath + path.sep + file
                });
            }
        });
        for(const entry of list){
            const script = entry.script;
            const version = entry.version;
            const description = entry.description;
            const fullpath = entry.fullpath;
            
            const [checkmig]: [any[], any] = await this.dbPool.promise().query("SELECT * FROM schema_version WHERE version = ? AND script = ?",[version,script]);
            if (checkmig.length == 0){
                const startTime = new Date().getTime();
                DbMigrateLogger.log("New migration file found: "+script);
                let migrationData = "";
                try {
                    migrationData = fs.readFileSync(fullpath, 'utf8')
                } catch (err) {
                    DbMigrateLogger.log("[Error] Unable to read migration file: "+fullpath);
                }
                
                const statements = migrationData.split(';');
                for(const statement of statements){
                    if (statement.match(/[A-Z0-9]/i)){
                        try{
                            await this.dbPool.promise().query(statement);
                        }catch(e: any){
                            DbMigrateLogger.log("ERROR: Unable to execute the following query: ");
                            console.log(statement);
                        }
                    }
                }
                const endTime = new Date().getTime();
                const executionTimeMs = Math.round((endTime - startTime));
                await this.dbPool.promise().query("INSERT INTO schema_version (version, description, type, script, installation_time, execution_time, status, installed_by) VALUES (?,?,?,?,NOW(),?,?,?)",[version,description,'SQL',script,executionTimeMs,0,computerName]);
            }else{
                DbMigrateLogger.log("Migration file found: "+script+' -- Already applied');
            }
        }
         
         DbMigrateLogger.log("DB Migration finished");
     }

}

export class DbMigrateLogger 
{
    public static log(content: string ) {
            console.log('[DBMigrate][' + (new Date()).toISOString() + '] ' + content);        
    }
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
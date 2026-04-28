import mysql, { Pool, PoolOptions } from 'mysql2';
import type { Pool as PromisePool } from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface DbMigrateConnectionSettings {
    host: string;
    username: string;
    password: string;
    database: string;
    port?: number;
    connectionLimit?: number;
    timezone?: string;
    /** Optional migration files directory; equivalent to calling setMigrationPath(). */
    migrationPath?: string;
    /** Optional logger; defaults to a console-based logger. Pass `null` to silence. */
    logger?: DbMigrateLogger | null;
}

export interface DbMigrateLogger {
    log(message: string): void;
    error(message: string): void;
}

export interface ParsedMigrationFile {
    script: string;
    version: string;
    description: string;
}

const FILENAME_REGEX = /^v([0-9]+(?:\.[0-9]+)*)__(.+)\.sql$/i;
const ADVISORY_LOCK_NAME = 'simple-mysql-migrate';
const ADVISORY_LOCK_TIMEOUT_SECONDS = 60;

const defaultLogger: DbMigrateLogger = {
    log(message: string) {
        console.log('[' + new Date().toISOString() + '][DBMigrate] ' + message);
    },
    error(message: string) {
        console.error('[' + new Date().toISOString() + '][DBMigrate] ' + message);
    },
};

const noopLogger: DbMigrateLogger = { log() { }, error() { } };

/**
 * Parse a migration filename of the form `v<version>__<description>.sql`.
 * Returns null if the filename does not match.
 */
export function parseMigrationFilename(filename: string): ParsedMigrationFile | null {
    const match = FILENAME_REGEX.exec(filename);
    if (!match) {
        return null;
    }
    return {
        script: filename,
        version: match[1],
        description: match[2].replace(/_/g, ' '),
    };
}

/**
 * Compare two dotted numeric version strings (e.g. `1.2.10` vs `1.2.9`).
 * Returns negative, zero, or positive in the usual sort-comparator sense.
 */
export function compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map((s) => parseInt(s, 10));
    const partsB = b.split('.').map((s) => parseInt(s, 10));
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
        const va = partsA[i] ?? 0;
        const vb = partsB[i] ?? 0;
        if (va !== vb) {
            return va - vb;
        }
    }
    return 0;
}

/**
 * Scan a directory and return migration files sorted by numeric version.
 * Throws if two files declare the same version.
 */
export function listMigrationFiles(dirPath: string): ParsedMigrationFile[] {
    const entries = fs.readdirSync(dirPath);
    const parsed: ParsedMigrationFile[] = [];
    for (const file of entries) {
        const p = parseMigrationFilename(file);
        if (p) {
            parsed.push(p);
        }
    }
    parsed.sort((a, b) => compareVersions(a.version, b.version));
    for (let i = 1; i < parsed.length; i++) {
        if (parsed[i].version === parsed[i - 1].version) {
            throw new Error(
                `Duplicate migration version "${parsed[i].version}" in files ` +
                `"${parsed[i - 1].script}" and "${parsed[i].script}"`
            );
        }
    }
    return parsed;
}

export default class DbMigrate {
    private readonly pool: PromisePool;
    private readonly rawPool: Pool;
    private readonly logger: DbMigrateLogger;
    private filesPath: string;

    public constructor(connectionSettings: DbMigrateConnectionSettings) {
        const options: PoolOptions = {
            host: connectionSettings.host,
            user: connectionSettings.username,
            password: connectionSettings.password,
            database: connectionSettings.database,
            timezone: connectionSettings.timezone ?? '+00:00',
            port: connectionSettings.port ?? 3306,
            connectionLimit: connectionSettings.connectionLimit ?? 50,
            multipleStatements: true,
        };
        this.rawPool = mysql.createPool(options);
        this.pool = this.rawPool.promise();
        this.logger =
            connectionSettings.logger === null
                ? noopLogger
                : connectionSettings.logger ?? defaultLogger;
        this.filesPath = '';
        if (connectionSettings.migrationPath) {
            this.setMigrationPath(connectionSettings.migrationPath);
        }
    }

    public setMigrationPath(migrationPath: string): void {
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration path is not valid: ${migrationPath}`);
        }
        this.filesPath = migrationPath;
    }

    /** Close the underlying connection pool. Call this when you're done. */
    public async close(): Promise<void> {
        await this.pool.end();
    }

    public async migrate(): Promise<void> {
        if (!this.filesPath) {
            throw new Error(
                'Migration path is not set; call setMigrationPath() or pass migrationPath in the constructor'
            );
        }

        await this.ensureSchemaTable();

        const installedBy = this.getHostname();
        const migrations = listMigrationFiles(this.filesPath);
        const acquired = await this.acquireLock();
        if (!acquired) {
            throw new Error(
                `Could not acquire advisory lock "${ADVISORY_LOCK_NAME}" within ${ADVISORY_LOCK_TIMEOUT_SECONDS}s; another migration may be in progress`
            );
        }

        try {
            for (const entry of migrations) {
                await this.applyOne(entry, installedBy);
            }
            this.logger.log('DB Migration finished');
        } finally {
            await this.releaseLock();
        }
    }

    private async ensureSchemaTable(): Promise<void> {
        const [tables] = (await this.pool.query(
            "SHOW TABLES LIKE 'schema_version'"
        )) as [unknown[], unknown];
        if (tables.length === 0) {
            this.logger.log('Schema Version table not found, creating...');
            await this.pool.query(
                'CREATE TABLE IF NOT EXISTS `schema_version` (' +
                '`revision` int(10) unsigned NOT NULL AUTO_INCREMENT,' +
                '`version` varchar(255) DEFAULT NULL,' +
                '`description` varchar(255) DEFAULT NULL,' +
                "`type` enum('SQL') DEFAULT NULL," +
                '`script` varchar(255) DEFAULT NULL,' +
                '`checksum` int(11) DEFAULT NULL,' +
                '`installed_rank` int(11) DEFAULT NULL,' +
                '`installed_by` varchar(255) DEFAULT NULL,' +
                '`installation_time` datetime DEFAULT NULL,' +
                '`execution_time` int(11) DEFAULT NULL,' +
                '`status` int(11) DEFAULT NULL,' +
                '`reason` text DEFAULT NULL,' +
                'PRIMARY KEY (`revision`)' +
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
            );
            this.logger.log('Schema Version table has been created');
        }
    }

    private async applyOne(entry: ParsedMigrationFile, installedBy: string): Promise<void> {
        const { script, version, description } = entry;
        const fullpath = path.join(this.filesPath, script);

        const [existing] = (await this.pool.query(
            'SELECT status FROM schema_version WHERE version = ? AND script = ?',
            [version, script]
        )) as [Array<{ status: number | null }>, unknown];

        if (existing.length > 0) {
            const successful = existing.some((row) => row.status === 0);
            if (successful) {
                this.logger.log(`Migration file found: ${script} -- Already applied`);
                return;
            }
            // Previous attempt failed; refuse to silently re-run.
            throw new Error(
                `Migration "${script}" has a previous failed attempt in schema_version. ` +
                `Resolve manually (fix the SQL and remove the failed row) before re-running.`
            );
        }

        this.logger.log(`New migration file found: ${script}`);

        let migrationData: string;
        try {
            migrationData = fs.readFileSync(fullpath, 'utf8');
        } catch (err) {
            throw new Error(`Unable to read migration file: ${fullpath}: ${(err as Error).message}`);
        }

        const startTime = Date.now();
        try {
            // multipleStatements is enabled on the pool; send the file as one query.
            await this.pool.query(migrationData);
        } catch (err) {
            const reason = (err as Error).message;
            const executionTimeMs = Date.now() - startTime;
            this.logger.error(`Migration "${script}" failed: ${reason}`);
            // Record the failure so operators can see what went wrong.
            try {
                await this.pool.query(
                    'INSERT INTO schema_version (version, description, type, script, installation_time, execution_time, status, installed_by, reason) ' +
                    'VALUES (?,?,?,?,NOW(),?,?,?,?)',
                    [version, description, 'SQL', script, executionTimeMs, 1, installedBy, reason]
                );
            } catch (recordErr) {
                this.logger.error(
                    `Additionally, failed to record the failure row: ${(recordErr as Error).message}`
                );
            }
            throw new Error(`Migration "${script}" failed: ${reason}`);
        }

        const executionTimeMs = Date.now() - startTime;
        await this.pool.query(
            'INSERT INTO schema_version (version, description, type, script, installation_time, execution_time, status, installed_by) ' +
            'VALUES (?,?,?,?,NOW(),?,?,?)',
            [version, description, 'SQL', script, executionTimeMs, 0, installedBy]
        );
    }

    private async acquireLock(): Promise<boolean> {
        const [rows] = (await this.pool.query('SELECT GET_LOCK(?, ?) AS got', [
            ADVISORY_LOCK_NAME,
            ADVISORY_LOCK_TIMEOUT_SECONDS,
        ])) as [Array<{ got: number | null }>, unknown];
        return rows[0]?.got === 1;
    }

    private async releaseLock(): Promise<void> {
        try {
            await this.pool.query('SELECT RELEASE_LOCK(?)', [ADVISORY_LOCK_NAME]);
        } catch (err) {
            this.logger.error(`Failed to release advisory lock: ${(err as Error).message}`);
        }
    }

    private getHostname(): string {
        try {
            return os.hostname();
        } catch {
            return 'unknown';
        }
    }
}

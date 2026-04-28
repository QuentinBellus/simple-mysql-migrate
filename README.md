# Simple-Mysql-Migrate

## Dead simple database migration for SQL only

The principle is similar to Flyway and similar tools, except it's VERY basic and runs in a few lines of code for Node.js. MySQL only.

### Install

```bash
npm install simple-mysql-migrate mysql2
```

`mysql2` is a peer dependency.

### Usage

TypeScript:

```typescript
import DbMigrate from 'simple-mysql-migrate';

const migration = new DbMigrate({
    host: '127.0.0.1',
    port: 3306,            // optional, default 3306
    username: 'my_user',
    password: 'my_password',
    database: 'my_database_name',
    timezone: '+00:00',    // optional, default '+00:00'
    connectionLimit: 50,   // optional, default 50
    migrationPath: '/path/to/migrations', // optional, can also use setMigrationPath()
});

try {
    await migration.migrate();
} finally {
    await migration.close();
}
```

JavaScript:

```javascript
const DbMigrate = require('simple-mysql-migrate').default;

const migration = new DbMigrate({
    host: '127.0.0.1',
    username: 'my_user',
    password: 'my_password',
    database: 'my_database_name',
});

migration.setMigrationPath('/path/to/migrations');
migration.migrate()
    .catch((err) => { console.error(err); process.exitCode = 1; })
    .finally(() => migration.close());
```

### How it works

It scans the directory for `.sql` files, sorts them by numeric version, and runs each file that hasn't already been applied. A `schema_version` table tracks what has been run.

Filenames must match `v<version>__<description>.sql`, for example `v1.2.5__new_user_table.sql`. The version is dotted numeric and is sorted numerically (so `v10.0.0` runs **after** `v2.0.0`, not before). Underscores in the description are turned into spaces.

Each `.sql` file is executed as a single multi-statement query, so feel free to put several `;`-separated statements in one file.

### Failure behaviour

If a migration fails, `migrate()` throws and a row is recorded in `schema_version` with a non-zero `status` and the error message in `reason`. Subsequent runs will refuse to proceed until you fix the SQL and remove the failed row manually. This is intentional — silently retrying a half-applied migration is dangerous.

> ⚠ MySQL implicitly commits before and after each DDL statement (`CREATE`, `ALTER`, `DROP`, etc.), so a multi-DDL migration that fails partway through is **not** automatically rolled back. Keep migrations small and idempotent where possible.

### Concurrency

A MySQL `GET_LOCK` advisory lock (`simple-mysql-migrate`) is acquired for the duration of `migrate()`, so it is safe to start multiple processes simultaneously — only one will run migrations at a time.

### Custom logger

```typescript
const migration = new DbMigrate({
    /* ... */
    logger: {
        log:   (m) => myLogger.info(m),
        error: (m) => myLogger.error(m),
    },
});
```

Pass `logger: null` to silence all output.


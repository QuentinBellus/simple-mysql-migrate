# Simple-DB-Migrate

## Dead simple database migration for SQL only

Migrates through code only, no CLI supported


```javascript
import DbMigrate from 'simple-db-migrate';

// These are the default settings if none are used
const migration = new DbMigrate ({
    "host": "127.0.0.1",
    "port": 3306,
    "username": "my_user",
    "password": "my_password",
    "database": "my_database_name"
});

migration.setMigrationPath("/path/to/my/migration/files/");
await migration.migrate();
```

It is dead simple: it will scan through the .sql files and run them in order.

A `schema_version` table will be created to keep track of what has already been ran. 

The filenames should be called `v[any version]__[any string].sql`, for example: `v1.2.5__new_user_table.sql`

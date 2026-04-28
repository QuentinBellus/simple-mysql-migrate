import {
    parseMigrationFilename,
    compareVersions,
    listMigrationFiles,
} from '../index';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('parseMigrationFilename', () => {
    it('parses a simple version', () => {
        expect(parseMigrationFilename('v1__init.sql')).toEqual({
            script: 'v1__init.sql',
            version: '1',
            description: 'init',
        });
    });

    it('parses a dotted version and converts underscores to spaces', () => {
        expect(parseMigrationFilename('v1.2.5__new_user_table.sql')).toEqual({
            script: 'v1.2.5__new_user_table.sql',
            version: '1.2.5',
            description: 'new user table',
        });
    });

    it('is case-insensitive on the prefix and extension', () => {
        expect(parseMigrationFilename('V2.0__Foo.SQL')?.version).toBe('2.0');
    });

    it('rejects unanchored matches', () => {
        expect(parseMigrationFilename('xv1__a.sql.bak')).toBeNull();
        expect(parseMigrationFilename('prefix_v1__a.sql')).toBeNull();
        expect(parseMigrationFilename('v1__a.sql.txt')).toBeNull();
    });

    it('rejects filenames missing the double underscore separator', () => {
        expect(parseMigrationFilename('v1_only_one.sql')).toBeNull();
    });

    it('rejects non-numeric versions', () => {
        expect(parseMigrationFilename('vabc__x.sql')).toBeNull();
    });
});

describe('compareVersions', () => {
    it('orders numerically, not lexicographically', () => {
        expect(compareVersions('2', '10')).toBeLessThan(0);
        expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    });

    it('treats missing trailing components as zero', () => {
        expect(compareVersions('1', '1.0.0')).toBe(0);
        expect(compareVersions('1.1', '1.0.5')).toBeGreaterThan(0);
    });

    it('returns 0 for equal versions', () => {
        expect(compareVersions('3.4.5', '3.4.5')).toBe(0);
    });

    it('sorts a list as expected', () => {
        const versions = ['1.10.0', '1.2.0', '1.2.10', '2.0.0', '1.2.9'];
        const sorted = [...versions].sort(compareVersions);
        expect(sorted).toEqual(['1.2.0', '1.2.9', '1.2.10', '1.10.0', '2.0.0']);
    });
});

describe('listMigrationFiles', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migtest-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function touch(name: string): void {
        fs.writeFileSync(path.join(tmp, name), '');
    }

    it('returns files sorted by numeric version', () => {
        touch('v10__c.sql');
        touch('v2__b.sql');
        touch('v1__a.sql');
        touch('readme.txt');
        const result = listMigrationFiles(tmp);
        expect(result.map((r) => r.script)).toEqual([
            'v1__a.sql',
            'v2__b.sql',
            'v10__c.sql',
        ]);
    });

    it('throws on duplicate version', () => {
        touch('v1.0__one.sql');
        touch('v1.0__two.sql');
        expect(() => listMigrationFiles(tmp)).toThrow(/Duplicate migration version/);
    });

    it('returns an empty array when no .sql files match', () => {
        touch('notes.md');
        expect(listMigrationFiles(tmp)).toEqual([]);
    });
});

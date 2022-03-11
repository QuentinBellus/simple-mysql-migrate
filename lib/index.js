"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbMigrateLogger = void 0;
var mysql2_1 = __importDefault(require("mysql2"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var os_1 = __importDefault(require("os"));
var DbMigrate = /** @class */ (function () {
    function DbMigrate(connectionSettings) {
        this.filesPath = "";
        this.dbPool = mysql2_1.default.createPool({
            host: connectionSettings.host,
            user: connectionSettings.username,
            password: connectionSettings.password,
            database: connectionSettings.database,
            timezone: connectionSettings.timezone ? connectionSettings.timezone : '+00:00',
            port: connectionSettings.port ? connectionSettings.port : 3306,
            connectionLimit: connectionSettings.connectionLimit ? connectionSettings.connectionLimit : 50,
        });
    }
    DbMigrate.prototype.setMigrationPath = function (path) {
        if (!fs_1.default.existsSync(path)) {
            throw new Error("Migration path is not valid");
        }
        this.filesPath = path;
    };
    DbMigrate.prototype.migrate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var computerName, tables, list, _i, list_1, entry, script, version, description, fullpath, checkmig, startTime, migrationData, statements, _a, statements_1, statement, e_1, endTime, executionTimeMs;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        computerName = os_1.default.hostname();
                        return [4 /*yield*/, this.dbPool.promise().query("SHOW TABLES LIKE 'schema_version'")];
                    case 1:
                        tables = (_b.sent())[0];
                        if (!(tables.length == 0)) return [3 /*break*/, 3];
                        DbMigrateLogger.log("Schema Version table not found, creating...");
                        return [4 /*yield*/, this.dbPool.promise().query("CREATE TABLE `schema_version` (`revision` int(10) unsigned NOT NULL AUTO_INCREMENT,`version` varchar(255) DEFAULT NULL,`description` varchar(255) DEFAULT NULL,`type` enum('SQL','Node.js') DEFAULT NULL,`script` varchar(255) DEFAULT NULL,`checksum` int(11) DEFAULT NULL,`installed_rank` int(11) DEFAULT NULL,`installed_by` varchar(255) DEFAULT NULL,`installation_time` datetime DEFAULT NULL,`execution_time` int(11) DEFAULT NULL,`status` int(11) DEFAULT NULL,`reason` text DEFAULT NULL,PRIMARY KEY (`revision`)) ENGINE=InnoDB DEFAULT CHARSET=utf8")];
                    case 2:
                        _b.sent();
                        DbMigrateLogger.log("Schema Version table has been created");
                        _b.label = 3;
                    case 3:
                        list = [];
                        fs_1.default.readdirSync(this.filesPath).forEach(function (file) {
                            var match = file.match(/v([0-9\.]+)\_\_(.*)\.sql/i);
                            if (match) {
                                var script = file;
                                var version = match[1];
                                var description = match[2].replace(/[_]/g, ' ');
                                list.push({
                                    script: script,
                                    version: version,
                                    description: description,
                                    fullpath: _this.filesPath + path_1.default.sep + file
                                });
                            }
                        });
                        _i = 0, list_1 = list;
                        _b.label = 4;
                    case 4:
                        if (!(_i < list_1.length)) return [3 /*break*/, 15];
                        entry = list_1[_i];
                        script = entry.script;
                        version = entry.version;
                        description = entry.description;
                        fullpath = entry.fullpath;
                        return [4 /*yield*/, this.dbPool.promise().query("SELECT * FROM schema_version WHERE version = ? AND script = ?", [version, script])];
                    case 5:
                        checkmig = (_b.sent())[0];
                        if (!(checkmig.length == 0)) return [3 /*break*/, 13];
                        startTime = new Date().getTime();
                        DbMigrateLogger.log("New migration file found: " + script);
                        migrationData = "";
                        try {
                            migrationData = fs_1.default.readFileSync(fullpath, 'utf8');
                        }
                        catch (err) {
                            DbMigrateLogger.log("[Error] Unable to read migration file: " + fullpath);
                        }
                        statements = migrationData.split(';');
                        _a = 0, statements_1 = statements;
                        _b.label = 6;
                    case 6:
                        if (!(_a < statements_1.length)) return [3 /*break*/, 11];
                        statement = statements_1[_a];
                        if (!statement.match(/[A-Z0-9]/i)) return [3 /*break*/, 10];
                        _b.label = 7;
                    case 7:
                        _b.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, this.dbPool.promise().query(statement)];
                    case 8:
                        _b.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        e_1 = _b.sent();
                        DbMigrateLogger.log("ERROR: Unable to execute the following query: ");
                        console.log(statement);
                        return [3 /*break*/, 10];
                    case 10:
                        _a++;
                        return [3 /*break*/, 6];
                    case 11:
                        endTime = new Date().getTime();
                        executionTimeMs = Math.round((endTime - startTime));
                        return [4 /*yield*/, this.dbPool.promise().query("INSERT INTO schema_version (version, description, type, script, installation_time, execution_time, status, installed_by) VALUES (?,?,?,?,NOW(),?,?,?)", [version, description, 'SQL', script, executionTimeMs, 0, computerName])];
                    case 12:
                        _b.sent();
                        return [3 /*break*/, 14];
                    case 13:
                        DbMigrateLogger.log("Migration file found: " + script + ' -- Already applied');
                        _b.label = 14;
                    case 14:
                        _i++;
                        return [3 /*break*/, 4];
                    case 15:
                        DbMigrateLogger.log("DB Migration finished");
                        return [2 /*return*/];
                }
            });
        });
    };
    return DbMigrate;
}());
exports.default = DbMigrate;
var DbMigrateLogger = /** @class */ (function () {
    function DbMigrateLogger() {
    }
    DbMigrateLogger.log = function (content) {
        console.log('[DBMigrate][' + (new Date()).toISOString() + '] ' + content);
    };
    return DbMigrateLogger;
}());
exports.DbMigrateLogger = DbMigrateLogger;

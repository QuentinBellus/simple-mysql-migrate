"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var mysql2_1 = __importDefault(require("mysql2"));
var DbMigrate = /** @class */ (function () {
    function DbMigrate(connectionSettings) {
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
    return DbMigrate;
}());
exports.default = DbMigrate;

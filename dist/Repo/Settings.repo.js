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
Object.defineProperty(exports, "__esModule", { value: true });
const DB_1 = require("../model/DB"); // (สมมติว่านี่คือไฟล์ DB Pool ของคุณ)
class SettingsRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    CampStatus(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            const sql = `SELECT * FROM exam_campaigns WHERE id = ?`;
            const [rows] = yield dbClient.execute(sql, [campaign_id]);
            return rows;
        });
    }
    QRStatus(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            var _a;
            const sql = `SELECT ec.qr_active  FROM exam_campaigns ec WHERE ec.id = ?`;
            const [rows] = yield dbClient.execute(sql, [campaign_id]);
            return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.qr_active) === 1;
        });
    }
}
const settingsRepo = new SettingsRepo();
exports.default = settingsRepo;

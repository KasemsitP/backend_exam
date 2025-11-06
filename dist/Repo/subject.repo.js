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
const DB_1 = require("../model/DB");
class SubjectRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    findByCode(code_1) {
        return __awaiter(this, arguments, void 0, function* (code, dbClient = this.pool) {
            const sql = "SELECT * FROM subjects WHERE code = ?";
            const [rows] = yield dbClient.execute(sql, [code]);
            return rows[0] || null;
        });
    }
    /**
     * สร้างวิชาใหม่
     */
    create(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, dbClient = this.pool) {
            const sql = "INSERT INTO subjects (code, name) VALUES (?, ?)";
            const [result] = yield dbClient.execute(sql, [
                payload.code,
                payload.name || null, // (ป้องกัน 'undefined')
            ]);
            const newId = result.insertId;
            return (yield this.findById(newId, dbClient));
        });
    }
    findById(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "SELECT * FROM subjects WHERE id = ?";
            const [rows] = yield dbClient.execute(sql, [id]);
            return rows[0] || null;
        });
    }
    /**
     * ⭐️ ค้นหา ถ้าเจอให้คืนค่า, ถ้าไม่เจอให้สร้าง
     * (นี่คือฟังก์ชันที่ Service เรียกใช้)
     */
    findOrCreateByCode(code_1, name_1) {
        return __awaiter(this, arguments, void 0, function* (code, name, dbClient = this.pool) {
            const existing = yield this.findByCode(code, dbClient);
            if (existing) {
                // (TODO: คุณอาจจะต้องเช็คว่า name ที่ส่งมาตรงกับ name ที่มีอยู่หรือไม่)
                return existing;
            }
            // ถ้าไม่เจอ สร้างใหม่
            return this.create({ code, name }, dbClient);
        });
    }
    /**
     * [ ⭐️ ฟังก์ชันใหม่ (หรืออัปเดต) ⭐️ ]
     * ลบวิชา (รองรับ Transaction)
     */
    delete(id_1) {
        return __awaiter(this, arguments, void 0, function* (id, dbClient = this.pool) {
            const sql = "DELETE FROM subjects WHERE id = ?";
            const [result] = yield dbClient.execute(sql, [id]);
            return result.affectedRows > 0;
        });
    }
}
const subjectRepo = new SubjectRepo();
exports.default = subjectRepo;

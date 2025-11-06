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
class ExamRoomRepo {
    // ดึงข้อมูลห้องสอบตาม session_id
    findBySessionId(sessionId, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "SELECT * FROM exam_rooms WHERE session_id = ? ORDER BY room_code ASC;";
            try {
                const [rows] = yield connection.execute(sql, [sessionId]);
                return rows;
            }
            catch (error) {
                console.error("Repo Error (Room FindAll):", error);
                throw error;
            }
        });
    }
    // Insert หรือ Update ห้องสอบ
    upsert(data, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
      INSERT INTO exam_rooms (session_id, room_code, capacity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE capacity = VALUES(capacity);
    `;
            try {
                const [result] = yield connection.execute(sql, [data.session_id, data.room_code, data.capacity]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Room Upsert):", error);
                throw error;
            }
        });
    }
    // ลบห้องสอบ
    delete(sessionId, roomCode, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = "DELETE FROM exam_rooms WHERE session_id = ? AND room_code = ?;";
            try {
                const [result] = yield connection.execute(sql, [sessionId, roomCode]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Room Delete):", error);
                throw error;
            }
        });
    }
}
const examRoomRepo = new ExamRoomRepo();
exports.default = examRoomRepo;

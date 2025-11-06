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
class BookletRepo {
    /**
     * (Bulk Insert Booklets)
     */
    bulkCreate(booklets, connection) {
        return __awaiter(this, void 0, void 0, function* () {
            if (booklets.length === 0)
                return;
            const sql = `
      INSERT INTO booklets (bag_id, user_session_id, qr_payload_raw, session_id, status)
      VALUES ?;
    `;
            // (แปลง [ {obj1}, {obj2} ] เป็น [ [val1, val2], [val1, val2] ])
            const values = booklets.map(b => [
                b.bag_id,
                b.user_session_id,
                b.qr_payload_raw,
                b.session_id,
                b.status
            ]);
            try {
                const [result] = yield connection.query(sql, [values]);
                return result;
            }
            catch (error) {
                console.error("Repo Error (Booklet Bulk Create):", error);
                throw error;
            }
        });
    }
}
const bookletRepo = new BookletRepo();
exports.default = bookletRepo;

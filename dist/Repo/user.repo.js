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
class userRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    getUsersByCampaign(campaignCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
  SELECT u.id, u.full_name
  FROM users u
  WHERE EXISTS (
    SELECT 1
    FROM user_sessions us
    JOIN sessions s ON s.id = us.session_id
    JOIN exam_campaigns c ON c.id = s.campaign_id
    WHERE us.user_id = u.id
      AND c.code = ?
  )
  ORDER BY u.full_name
  
`;
            const [rows] = yield this.pool.execute(sql, [campaignCode]);
            return rows;
        });
    }
}
const userepo = new userRepo();
exports.default = userepo;

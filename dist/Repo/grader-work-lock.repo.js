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
class GraderWorkLockRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    findBagReportHeader(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT 
  gw.id AS lock_id,
  gw.grader_id,
  gw.bag_id,
  gw.question_no,
  gw.status,
  a.full_name AS grader_name,

  b.bag_no,
  s.id AS session_id,
  s.session_code,

  sub.id AS subject_id,
  sub.name AS subject_name,

  COUNT(DISTINCT bk.id) AS total_booklets,
  MIN(CAST(bk.random_num AS UNSIGNED)) AS min_random,
  MAX(CAST(bk.random_num AS UNSIGNED)) AS max_random

FROM grader_work_locks gw

LEFT JOIN bags b
  ON b.id = gw.bag_id

LEFT JOIN sessions s
  ON s.id = b.session_id

LEFT JOIN session_subjects ss
  ON ss.session_id = s.id

LEFT JOIN subjects sub
  ON sub.id = ss.subject_id

LEFT JOIN booklets bk
  ON bk.bag_id = b.id

LEFT JOIN graders g
  ON g.id = gw.grader_id

LEFT JOIN accounts a
  ON a.id = g.account_id

WHERE gw.campaign_id = ?
  AND gw.status = 'ACTIVE'

GROUP BY
  gw.id,
  gw.grader_id,
  gw.bag_id,
  gw.question_no,
  gw.status,
  a.full_name,
  b.bag_no,
  s.id,
  s.session_code,
  sub.id,
  sub.name;
    `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows.length > 0 ? rows[0] : null;
        });
    }
}
const graderWorkLockRepo = new GraderWorkLockRepo();
exports.default = graderWorkLockRepo;

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
class Seatrepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    GetAllUserByCampaign(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT u.id, u.user_code, u.full_name, u.first_name, u.last_name, u.title
FROM users u
JOIN user_campaigns uc ON u.id = uc.user_id
WHERE uc.campaign_id = ?
  AND uc.room_code IS NULL;
`;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows;
        });
    }
    //     async GetAllUserByCampaign(campaign_id: number): Promise<UserData[]> {
    //         const sql = `SELECT u.id, u.user_code, u.full_name, u.first_name, u.last_name, u.title
    //    FROM users u
    //    JOIN user_campaigns uc ON u.id = uc.user_id
    //   WHERE uc.campaign_id = ?
    // `
    //         const [rows] = await this.pool.execute<RowDataPacket[]>(sql
    //             ,
    //             [campaign_id]
    //         );
    //         return rows as UserData[];
    //     }
    GetAllUserByCampaignNotNULL(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT u.id, u.user_code, u.full_name, u.first_name, u.last_name, u.title
   FROM users u
   JOIN user_campaigns uc ON u.id = uc.user_id
  WHERE uc.campaign_id = ?
    AND uc.row_no IS NULL
    AND uc.col_no IS NULL;
`;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows;
        });
    }
    //select u.id , u.user_code , u.full_name , u.first_name , u.last_name , u.title   from users u  LEFT JOIN user_campaigns uc on u.id = uc.user_id WHERE uc.campaign_id = ?;
    deleteRoomSeats(conn, campaign_id, roomCode) {
        return __awaiter(this, void 0, void 0, function* () {
            yield conn.execute("DELETE FROM room_seats WHERE campaign_id = ? AND room_code = ?", [campaign_id, roomCode]);
        });
    }
    clearSeatsForRoom(campaign_id, roomCode, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            yield conn.execute(`
      UPDATE user_campaigns
      SET room_code = NULL,
          row_no   = NULL,
          col_no   = NULL
      WHERE campaign_id = ?
        AND room_code   = ?
      `, [campaign_id, roomCode]);
        });
    }
    saveSeatAssignments(campaign_id, roomCode, seats, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const seat of seats) {
                yield conn.execute(`
        UPDATE user_campaigns
        SET room_code = ?,
            row_no    = ?,
            col_no    = ?
        WHERE campaign_id = ?
          AND user_id     = ?
        `, [roomCode, seat.row_no, seat.col_no, campaign_id, seat.user_id]);
            }
        });
    }
    getUserSeat(roomCode, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
    SELECT 
      u.id,
      u.user_code,
      u.full_name,
      u.first_name,
      u.last_name,
      u.title,
      uc.row_no,
      uc.col_no
    FROM user_campaigns uc
    JOIN users u 
      ON u.id = uc.user_id
    WHERE uc.room_code   = ?
      AND uc.campaign_id = ?
      AND uc.row_no IS NOT NULL
      AND uc.col_no IS NOT NULL
    ORDER BY uc.row_no, uc.col_no;
  `;
            const [rows] = yield this.pool.execute(sql, [
                roomCode,
                campaign_id,
            ]);
            return rows;
        });
    }
    isAssigned(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT 
  r.room_code,
  COUNT(DISTINCT uc.user_id) AS count_user
FROM exam_rooms r
LEFT JOIN user_campaigns uc
  ON uc.room_code = r.room_code
 AND uc.campaign_id = ?
GROUP BY r.room_code;

  `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            return rows;
        });
    }
    ResetSeat(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `UPDATE user_campaigns
       SET room_code = NULL,
           row_no   = NULL,
           col_no   = NULL,
           seat_code = NULL
       WHERE campaign_id = ?`;
            const result = yield this.pool.execute(sql, [campaign_id]);
        });
    }
    GetAllUsersCount(campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `
SELECT
  COUNT(*) AS total_users,
  SUM(CASE WHEN uc.room_code IS NOT NULL THEN 1 ELSE 0 END) AS total_users_assigned_room
FROM user_campaigns uc
WHERE uc.campaign_id = ?;
;
  `;
            const [rows] = yield this.pool.execute(sql, [campaign_id]);
            const row = rows[0];
            return {
                total_users: Number(row.total_users),
                total_users_assigned_room: Number(row.total_users_assigned_room),
            };
        });
    }
}
const seatrepo = new Seatrepo();
exports.default = seatrepo;

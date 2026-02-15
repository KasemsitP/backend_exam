



import { DB } from "../model/DB";
import { Pool, PoolConnection } from "mysql2/promise";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface UserData {
    id: number;
    user_code: string;
    full_name: string;
    first_name: string;
    last_name: string;
    title: string;
    row_no?: number;
    col_no?: number;
}
// 1-based / 0-based จะจัดใน repo
export interface SeatLayoutItem {
    user_campaign_id: number;
    user_id: number;
    user_code: string;
    full_name: string;
    last_name: string;

    rowIndex: number; // 0-based index ใน array
    colIndex: number; // 0-based index ใน array
}

export interface UserSeatRow extends UserData {
    row_no: number;
    col_no: number;
}

export interface SeatAssignment {
    user_id: number;
    row_no: number;
    col_no: number;
}
class Seatrepo {
    private pool: Pool
    constructor() {
        this.pool = DB.getInstance();
    }


    async GetAllUserByCampaign(campaign_id: number): Promise<UserData[]> {

        const sql = `SELECT u.id, u.user_code, u.full_name, u.first_name, u.last_name, u.title
FROM users u
JOIN user_campaigns uc ON u.id = uc.user_id
WHERE uc.campaign_id = ?
  AND uc.room_code IS NULL;
`
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql
            ,
            [campaign_id]
        );
        return rows as UserData[];
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

    async GetAllUserByCampaignNotNULL(campaign_id: number): Promise<UserData[]> {

        const sql = `SELECT u.id, u.user_code, u.full_name, u.first_name, u.last_name, u.title
   FROM users u
   JOIN user_campaigns uc ON u.id = uc.user_id
  WHERE uc.campaign_id = ?
    AND uc.row_no IS NULL
    AND uc.col_no IS NULL;
`
        const [rows] = await this.pool.execute<RowDataPacket[]>(sql
            ,
            [campaign_id]
        );
        return rows as UserData[];
    }

    //select u.id , u.user_code , u.full_name , u.first_name , u.last_name , u.title   from users u  LEFT JOIN user_campaigns uc on u.id = uc.user_id WHERE uc.campaign_id = ?;
    async deleteRoomSeats(
        conn: PoolConnection,
        campaign_id: number,
        roomCode: string
    ): Promise<void> {
        await conn.execute(
            "DELETE FROM room_seats WHERE campaign_id = ? AND room_code = ?",
            [campaign_id, roomCode]
        );
    }

    async clearSeatsForRoom(
        campaign_id: number,
        roomCode: string,
        conn: PoolConnection
    ): Promise<void> {
        await conn.execute(
            `
      UPDATE user_campaigns
      SET room_code = NULL,
          row_no   = NULL,
          col_no   = NULL
      WHERE campaign_id = ?
        AND room_code   = ?
      `,
            [campaign_id, roomCode]
        );
    }


    async saveSeatAssignments(
        campaign_id: number,
        roomCode: string,
        seats: SeatAssignment[],
        conn: PoolConnection
    ): Promise<void> {
        for (const seat of seats) {
            await conn.execute(
                `
        UPDATE user_campaigns
        SET room_code = ?,
            row_no    = ?,
            col_no    = ?
        WHERE campaign_id = ?
          AND user_id     = ?
        `,
                [roomCode, seat.row_no, seat.col_no, campaign_id, seat.user_id]
            );
        }
    }

    async getUserSeat(
        roomCode: string,
        campaign_id: number
    ): Promise<UserSeatRow[]> {
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

        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [
            roomCode,
            campaign_id,
        ]);
        return rows as UserSeatRow[];
    }

    async isAssigned(campaign_id: number): Promise<any> {
        const sql = `
SELECT 
  r.room_code,
  COUNT(DISTINCT uc.user_id) AS count_user
FROM exam_rooms r
LEFT JOIN user_campaigns uc
  ON uc.room_code = r.room_code
 AND uc.campaign_id = ?
GROUP BY r.room_code;

  `

        const [rows] = await this.pool.execute<RowDataPacket[]>(sql, [campaign_id])
        return rows
    }

    async ResetSeat(campaign_id: number): Promise<void> {
        const sql = `UPDATE user_campaigns
       SET room_code = NULL,
           row_no   = NULL,
           col_no   = NULL,
           seat_code = NULL
       WHERE campaign_id = ?`
        const result = await this.pool.execute(sql, [campaign_id])
    }
    async GetAllUsersCount(campaign_id: number): Promise<any> {
        const sql = `
SELECT
  COUNT(*) AS total_users,
  SUM(CASE WHEN uc.room_code IS NOT NULL THEN 1 ELSE 0 END) AS total_users_assigned_room
FROM user_campaigns uc
WHERE uc.campaign_id = ?;
;
  `;
        const [rows] = await this.pool.execute<
            (RowDataPacket & {
                total_users: number;
                total_users_assigned_room: number;
            })[]
        >(sql, [campaign_id]);

        const row = rows[0];

        return {
            total_users: Number(row.total_users),
            total_users_assigned_room: Number(row.total_users_assigned_room),
        };
    }


}

const seatrepo = new Seatrepo()
export default seatrepo
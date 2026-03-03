import seatrepo from "../Repo/seat.repo"
import { DB } from "../model/DB";
import { UserData } from "../Repo/seat.repo";
import { SeatAssignment } from "../Repo/seat.repo";
import examRoomRepo from "../Repo/examroom.repo";



function hasConflict(rows: UserData[][], i: number, j: number): boolean {
    const row = rows[i];
    if (!row) return false;
    const current = row[j];
    if (!current) return false;

    const ln = current.last_name;

    const neighbors = [
        rows[i - 1]?.[j], // บน
        rows[i + 1]?.[j], // ล่าง
        row[j - 1],       // ซ้าย
        row[j + 1],       // ขวา
    ];

    return neighbors.some(n => n && n.last_name === ln);
}

export const mockUsers: UserData[] = [
    // กลุ่มนามสกุล Smith
    { id: 1, user_code: "0001", title: "Mr.", first_name: "John", last_name: "Smith", full_name: "Mr. John Smith" },
    { id: 2, user_code: "0002", title: "Ms.", first_name: "Anna", last_name: "Smith", full_name: "Ms. Anna Smith" },
    { id: 3, user_code: "0003", title: "Mr.", first_name: "Brian", last_name: "Smith", full_name: "Mr. Brian Smith" },

    // กลุ่มนามสกุล Brown
    { id: 4, user_code: "0004", title: "Mr.", first_name: "Chris", last_name: "Brown", full_name: "Mr. Chris Brown" },
    { id: 5, user_code: "0005", title: "Ms.", first_name: "Emily", last_name: "Brown", full_name: "Ms. Emily Brown" },
    { id: 6, user_code: "0006", title: "Mr.", first_name: "David", last_name: "Brown", full_name: "Mr. David Brown" },

    // กลุ่มนามสกุล Johnson
    { id: 7, user_code: "0007", title: "Mr.", first_name: "Ethan", last_name: "Johnson", full_name: "Mr. Ethan Johnson" },
    { id: 8, user_code: "0008", title: "Ms.", first_name: "Grace", last_name: "Johnson", full_name: "Ms. Grace Johnson" },

    // กลุ่มนามสกุล Lee
    { id: 9, user_code: "0009", title: "Mr.", first_name: "Henry", last_name: "Lee", full_name: "Mr. Henry Lee" },
    { id: 10, user_code: "0010", title: "Ms.", first_name: "Irene", last_name: "Lee", full_name: "Ms. Irene Lee" },
    { id: 11, user_code: "0011", title: "Mr.", first_name: "Jack", last_name: "Lee", full_name: "Mr. Jack Lee" },

    // กลุ่มนามสกุล Wong
    { id: 12, user_code: "0012", title: "Mr.", first_name: "Ken", last_name: "Wong", full_name: "Mr. Ken Wong" },
    { id: 13, user_code: "0013", title: "Ms.", first_name: "Lily", last_name: "Wong", full_name: "Ms. Lily Wong" },

    // กลุ่มนามสกุล Garcia
    { id: 14, user_code: "0014", title: "Mr.", first_name: "Marco", last_name: "Garcia", full_name: "Mr. Marco Garcia" },
    { id: 15, user_code: "0015", title: "Ms.", first_name: "Nina", last_name: "Garcia", full_name: "Ms. Nina Garcia" },

    // กลุ่มนามสกุล Kim
    { id: 16, user_code: "0016", title: "Mr.", first_name: "Oscar", last_name: "Kim", full_name: "Mr. Oscar Kim" },
    { id: 17, user_code: "0017", title: "Ms.", first_name: "Paula", last_name: "Kim", full_name: "Ms. Paula Kim" },

    // กลุ่มนามสกุล Patel
    { id: 18, user_code: "0018", title: "Mr.", first_name: "Ravi", last_name: "Patel", full_name: "Mr. Ravi Patel" },
    { id: 19, user_code: "0019", title: "Ms.", first_name: "Sara", last_name: "Patel", full_name: "Ms. Sara Patel" },

    // กลุ่มนามสกุล Chan
    { id: 20, user_code: "0020", title: "Mr.", first_name: "Tom", last_name: "Chan", full_name: "Mr. Tom Chan" },
    { id: 21, user_code: "0021", title: "Ms.", first_name: "Vicky", last_name: "Chan", full_name: "Ms. Vicky Chan" },

    // เพิ่มอีกนิดให้เกินหลายแถว (5 ที่นั่งต่อแถว)
    { id: 22, user_code: "0022", title: "Mr.", first_name: "Will", last_name: "Smith", full_name: "Mr. Will Smith" },
    { id: 23, user_code: "0023", title: "Ms.", first_name: "Yara", last_name: "Brown", full_name: "Ms. Yara Brown" },
    { id: 24, user_code: "0024", title: "Mr.", first_name: "Zack", last_name: "Lee", full_name: "Mr. Zack Lee" },
];

type SeatPos = { r: number; c: number };

function findConflicts(rows: UserData[][]): SeatPos[] {
    const result: SeatPos[] = [];

    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            if (hasConflict(rows, r, c)) {
                result.push({ r, c });
            }
        }
    }
    return result;
}
type SeatLayoutItem = {
    rowIndex: number;
    colIndex: number;
    user_id: number;
    user_code: string;
    full_name: string;
    last_name: string;
};
type SeatApiResponse = {
    campaignId: string;
    roomCode: string;
    seatsPerRow: number;
    seats: Array<{
        rowIndex: number;
        colIndex: number;
        user_id: number;
        user_code: string;
        full_name: string;
        last_name: string;
    }>;
};

type AssignedStat = {
    room_code: string;
    count_user: number;
};





export class seatService {

   static async ArrangeSeat(campaign_id: number, RoomCode: string, seatsPerRow: number) {
        const NumberSeatper = seatsPerRow ?? 5;

        const users = await seatrepo.GetAllUserByCampaign(Number(campaign_id));
        const examrooms = await examRoomRepo.findByCampaignIdCon(campaign_id);
        const realRoom = examrooms.find(r => r.room_code === RoomCode);

        if (!realRoom) {
            throw new Error(`Room ${RoomCode} not found in campaign ${campaign_id}`);
        }

        const roomCapacity = realRoom.capacity;
        
       const usersForThisRoom = users.slice(0, roomCapacity);
        const rows: UserData[][] = [];
        const numRows = Math.ceil(usersForThisRoom.length / NumberSeatper);

        // 🚀 OPTIMIZATION 1: วางที่นั่งแบบชาญฉลาด (Greedy Placement)
        for (let r = 0; r < numRows; r++) {
            // ดึงกลุ่มคนสำหรับแถวนี้เท่านั้น (รับประกันว่าเลขที่นั่งยังคงตามแถว)
            const rowUsers = usersForThisRoom.slice(r * NumberSeatper, (r + 1) * NumberSeatper);
            const placedRow: UserData[] = new Array(rowUsers.length).fill(null);
            const availableUsers = [...rowUsers];

            for (let c = 0; c < rowUsers.length; c++) {
                let bestIdx = -1;
                
                // พยายามหาคนในกลุ่มที่ "นามสกุลไม่ชนคนทางซ้าย และไม่ชนคนข้างบน"
                for (let i = 0; i < availableUsers.length; i++) {
                    const u = availableUsers[i];
                    const leftConflict = c > 0 && placedRow[c - 1]?.last_name === u.last_name;
                    const topConflict = r > 0 && rows[r - 1]?.[c]?.last_name === u.last_name;
                    
                    if (!leftConflict && !topConflict) {
                        bestIdx = i; // เจอคนรอดแล้ว เอาคนนี้แหละ!
                        break;
                    }
                }

                // ถ้าหาไม่ได้จริงๆ (กรณี Worst Case ในแถวนั้นนามสกุลเหมือนกันหมด) ให้หยิบคนแรกมาวางก่อน
                if (bestIdx === -1) bestIdx = 0;

                placedRow[c] = availableUsers[bestIdx];
                availableUsers.splice(bestIdx, 1);
            }
            rows.push(placedRow);
        }

        // 🚀 OPTIMIZATION 2: Pass Swap แบบเดิม แต่จะทำงานน้อยลงมากๆ เพราะเราจัดไว้ดีแล้ว 99%
        const MAX_PASSES = 10;
        for (let pass = 0; pass < MAX_PASSES; pass++) {
            const conflicts = findConflicts(rows);
            if (conflicts.length === 0) break;

            let changed = false;
            for (const { r, c } of conflicts) {
                // สลับเฉพาะคนในแถวเดียวกัน (r)
                for (let k = 0; k < rows[r].length; k++) {
                    if (k === c) continue;
                    if (rows[r][k].last_name === rows[r][c].last_name) continue;

                    [rows[r][c], rows[r][k]] = [rows[r][k], rows[r][c]];

                    if (!hasConflict(rows, r, c) && !hasConflict(rows, r, k)) {
                        changed = true;
                        break;
                    }

                    [rows[r][c], rows[r][k]] = [rows[r][k], rows[r][c]];
                }
            }
            if (!changed) break; // ถ้าติดแหง็ก (แก้ไม่ได้แล้ว) ก็ให้หยุดทันที ไม่เปลือง CPU
        }

        return rows;
    }
    static async ArrangeSeatCreate(
        campaign_id: number,
        roomCode: string,
        seatsPerRow: number
    ): Promise<{ seatsPerRow: number; seats: SeatLayoutItem[] }> {
        const rows = await this.ArrangeSeat(campaign_id, roomCode, seatsPerRow);

        const seats: SeatLayoutItem[] = [];
        for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
                const u = rows[r][c];
                seats.push({
                    rowIndex: r,
                    colIndex: c,
                    user_id: u.id,
                    user_code: u.user_code,
                    full_name: u.full_name,
                    last_name: u.last_name,
                });
            }
        }

        return {
            seatsPerRow,
            seats,
        };
    }

    static async ArrangeSeatAndCommit(
        campaign_id: number,
        roomCode: string,
        seatsPerRow: number
    ) {
        const conn = await DB.getInstance().getConnection();

        try {
            await conn.beginTransaction();

            const { seatsPerRow: finalSeatsPerRow, seats } =
                await seatService.ArrangeSeatCreate(campaign_id, roomCode, seatsPerRow);
            //  console.log(seats)
            await seatrepo.clearSeatsForRoom(campaign_id, roomCode, conn);

            const assignments: SeatAssignment[] = seats.map((s) => ({
                user_id: s.user_id,
                row_no: s.rowIndex + 1,
                col_no: s.colIndex + 1,
            }));

            console.log("test", assignments)

            await seatrepo.saveSeatAssignments(
                campaign_id,
                roomCode,
                assignments,
                conn
            );

            await conn.commit();


            return {
                seatsPerRow: finalSeatsPerRow,
                seats,
            };
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    }

    static async getSeatUser(campaignId: number, roomCode: string): Promise<SeatApiResponse> {
        const rows = await seatrepo.getUserSeat(roomCode, campaignId);
        console.log("test", rows)

        if (!rows.length) {
            return {
                campaignId: String(campaignId),
                roomCode,
                seatsPerRow: 0,
                seats: [],
            };
        }
        const seatsPerRow = rows.reduce(
            (max, r) => Math.max(max, Number(r.col_no)),
            0
        );


        const seats = rows.map((r) => ({
            rowIndex: Number(r.row_no) - 1,
            colIndex: Number(r.col_no) - 1,
            user_id: r.id,
            user_code: r.user_code,
            full_name: r.full_name,
            last_name: r.last_name ?? "",
        }));

        return {
            campaignId: String(campaignId),
            roomCode,
            seatsPerRow,
            seats,
        };
    }
    static async IsAssigned(campaignId: number) {
        const result = await seatrepo.isAssigned(campaignId)
        console.log(result)
        return result;
    }
    static async ResetSeat(campaignId: number) {
        await seatrepo.ResetSeat(campaignId)
        //     console.log(result)
        //
    }
    static async GetStatusUserCount(campaignId: number) {
        const result = await seatrepo.GetAllUsersCount(campaignId)
        console.log(result)
        return result;
    }

}
import seatrepo from "../Repo/seat.repo"
import { DB } from "../model/DB";
import { UserData } from "../Repo/seat.repo";
import { SeatAssignment } from "../Repo/seat.repo";

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




export class seatService {

    static async ArrangeSeat(campaign_id: number, RoomCode: string, seatsPerRow: number) {

        const NumberSeatper = seatsPerRow ?? 5;
        const users = await seatrepo.GetAllUserByCampaign(Number(campaign_id))
        // console.log(users)
        //const users = mockUsers

        const sortedusers = users.sort((a, b) => Number(a.user_code) - Number(b.user_code))
        // console.log(sortedusers)

        const rows: UserData[][] = [];

        sortedusers.forEach((user, idx) => {
            const rowIndex = Math.floor(idx / NumberSeatper);
            if (!rows[rowIndex]) {
                rows[rowIndex] = [];
            }
            rows[rowIndex].push(user);
        });

        console.log(
            rows.map((row, idx) =>
                `Row ${idx + 1}: ` +
                row.map(u => u.last_name).join(", ")
            ).join("\n")
        );


        // for (let i = 0; i < rows.length; i++) {
        //     for (let j = 0; j < rows[i].length; j++) {
        //         console.log(`Row ${i + 1}, Seat ${j + 1}:`, rows[i][j]);
        //     }
        // }
        // const MAX_PASSES = 10;

        // for (let pass = 0; pass < MAX_PASSES; pass++) {
        //     let changed = false;

        //     for (let i = 0; i < rows.length; i++) {
        //         for (let j = 0; j < rows[i].length; j++) {

        //             if (!hasConflict(rows, i, j)) continue;

        //             for (let k = 0; k < rows[i].length; k++) {
        //                 if (k === j) continue;
        //                 if (rows[i][k].last_name === rows[i][j].last_name) continue;

        //                 [rows[i][j], rows[i][k]] = [rows[i][k], rows[i][j]];

        //                 if (!hasConflict(rows, i, j) && !hasConflict(rows, i, k)) {
        //                     console.log(`🔄 Swap Row ${i + 1}: Seat ${j + 1} <-> Seat ${k + 1}`);
        //                     changed = true;
        //                     break;
        //                 }

        //                 [rows[i][j], rows[i][k]] = [rows[i][k], rows[i][j]];
        //             }
        //         }
        //     }

        //     if (!changed) break; // ถ้าไม่มีอะไรสลับเพิ่มแล้ว ก็จบ
        // }
        const MAX_PASSES = 10;

        for (let pass = 0; pass < MAX_PASSES; pass++) {

            const conflicts = findConflicts(rows);
            if (conflicts.length === 0) break;

            let changed = false;

            for (const { r, c } of conflicts) {

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

            if (!changed) break;
        }



        // console.log(
        //     rows.map((row, idx) =>
        //         `Row ${idx + 1}: ` +
        //         row.map(u => u.last_name).join(", ")
        //     ).join("\n")
        // );


        console.log(
            rows.map((row, idx) => {
                const usersStr = row
                    .map(user => `${user.user_code}:${user.full_name}`)
                    .join(", ");
                return `Row ${idx + 1}: [${usersStr}]`;
            }).join("\n")
        );

        // console.log(columns)

        return rows


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
  console.log("test",rows)

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

}
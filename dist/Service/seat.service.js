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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seatService = exports.mockUsers = void 0;
const seat_repo_1 = __importDefault(require("../Repo/seat.repo"));
const DB_1 = require("../model/DB");
const examRoom_repo_1 = __importDefault(require("../Repo/examRoom.repo"));
function hasConflict(rows, i, j) {
    var _a, _b;
    const row = rows[i];
    if (!row)
        return false;
    const current = row[j];
    if (!current)
        return false;
    const ln = current.last_name;
    const neighbors = [
        (_a = rows[i - 1]) === null || _a === void 0 ? void 0 : _a[j], // บน
        (_b = rows[i + 1]) === null || _b === void 0 ? void 0 : _b[j], // ล่าง
        row[j - 1], // ซ้าย
        row[j + 1], // ขวา
    ];
    return neighbors.some(n => n && n.last_name === ln);
}
exports.mockUsers = [
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
function findConflicts(rows) {
    const result = [];
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            if (hasConflict(rows, r, c)) {
                result.push({ r, c });
            }
        }
    }
    return result;
}
class seatService {
    static ArrangeSeat(campaign_id, RoomCode, seatsPerRow) {
        return __awaiter(this, void 0, void 0, function* () {
            const NumberSeatper = seatsPerRow !== null && seatsPerRow !== void 0 ? seatsPerRow : 5;
            // 1) ดึงคนที่ "ยังไม่ถูกจัด" ใน campaign นี้
            const users = yield seat_repo_1.default.GetAllUserByCampaign(Number(campaign_id));
            // 2) ดึงข้อมูลห้องใน campaign นี้ แล้วหาเฉพาะห้องที่เราจัดอยู่
            const examrooms = yield examRoom_repo_1.default.findByCampaignIdCon(campaign_id);
            const realRoom = examrooms.find(r => r.room_code === RoomCode);
            // กันกรณีหาไม่เจอ
            if (!realRoom) {
                throw new Error(`Room ${RoomCode} not found in campaign ${campaign_id}`);
            }
            const roomCapacity = realRoom.capacity; // เช่น = 5
            // 3) เลือกเฉพาะจำนวนคนตามความจุห้อง
            const usersForThisRoom = users
                .sort((a, b) => Number(a.user_code) - Number(b.user_code))
                .slice(0, roomCapacity); //  ตรงนี้คือ limit ตาม capacity
            const rows = [];
            usersForThisRoom.forEach((user, idx) => {
                const rowIndex = Math.floor(idx / NumberSeatper);
                if (!rows[rowIndex])
                    rows[rowIndex] = [];
                rows[rowIndex].push(user);
            });
            console.log(rows.map((row, idx) => `Row ${idx + 1}: ` +
                row.map(u => u.last_name).join(", ")).join("\n"));
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
                if (conflicts.length === 0)
                    break;
                let changed = false;
                for (const { r, c } of conflicts) {
                    for (let k = 0; k < rows[r].length; k++) {
                        if (k === c)
                            continue;
                        if (rows[r][k].last_name === rows[r][c].last_name)
                            continue;
                        [rows[r][c], rows[r][k]] = [rows[r][k], rows[r][c]];
                        if (!hasConflict(rows, r, c) && !hasConflict(rows, r, k)) {
                            changed = true;
                            break;
                        }
                        [rows[r][c], rows[r][k]] = [rows[r][k], rows[r][c]];
                    }
                }
                if (!changed)
                    break;
            }
            // console.log(
            //     rows.map((row, idx) =>
            //         `Row ${idx + 1}: ` +
            //         row.map(u => u.last_name).join(", ")
            //     ).join("\n")
            // );
            console.log(rows.map((row, idx) => {
                const usersStr = row
                    .map(user => `${user.user_code}:${user.full_name}`)
                    .join(", ");
                return `Row ${idx + 1}: [${usersStr}]`;
            }).join("\n"));
            // console.log(columns)
            return rows;
        });
    }
    static ArrangeSeatCreate(campaign_id, roomCode, seatsPerRow) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield this.ArrangeSeat(campaign_id, roomCode, seatsPerRow);
            const seats = [];
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
        });
    }
    static ArrangeSeatAndCommit(campaign_id, roomCode, seatsPerRow) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                const { seatsPerRow: finalSeatsPerRow, seats } = yield seatService.ArrangeSeatCreate(campaign_id, roomCode, seatsPerRow);
                //  console.log(seats)
                yield seat_repo_1.default.clearSeatsForRoom(campaign_id, roomCode, conn);
                const assignments = seats.map((s) => ({
                    user_id: s.user_id,
                    row_no: s.rowIndex + 1,
                    col_no: s.colIndex + 1,
                }));
                console.log("test", assignments);
                yield seat_repo_1.default.saveSeatAssignments(campaign_id, roomCode, assignments, conn);
                yield conn.commit();
                return {
                    seatsPerRow: finalSeatsPerRow,
                    seats,
                };
            }
            catch (err) {
                yield conn.rollback();
                throw err;
            }
            finally {
                conn.release();
            }
        });
    }
    static getSeatUser(campaignId, roomCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = yield seat_repo_1.default.getUserSeat(roomCode, campaignId);
            console.log("test", rows);
            if (!rows.length) {
                return {
                    campaignId: String(campaignId),
                    roomCode,
                    seatsPerRow: 0,
                    seats: [],
                };
            }
            const seatsPerRow = rows.reduce((max, r) => Math.max(max, Number(r.col_no)), 0);
            const seats = rows.map((r) => {
                var _a;
                return ({
                    rowIndex: Number(r.row_no) - 1,
                    colIndex: Number(r.col_no) - 1,
                    user_id: r.id,
                    user_code: r.user_code,
                    full_name: r.full_name,
                    last_name: (_a = r.last_name) !== null && _a !== void 0 ? _a : "",
                });
            });
            return {
                campaignId: String(campaignId),
                roomCode,
                seatsPerRow,
                seats,
            };
        });
    }
    static IsAssigned(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield seat_repo_1.default.isAssigned(campaignId);
            console.log(result);
            return result;
        });
    }
    static ResetSeat(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield seat_repo_1.default.ResetSeat(campaignId);
            //     console.log(result)
            //
        });
    }
    static GetStatusUserCount(campaignId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield seat_repo_1.default.GetAllUsersCount(campaignId);
            console.log(result);
            return result;
        });
    }
}
exports.seatService = seatService;

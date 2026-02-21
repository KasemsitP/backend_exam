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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.bagService = void 0;
const DB_1 = require("../model/DB");
const key_service_1 = require("./key.service");
const user_session_repo_1 = __importDefault(require("../Repo/user-session.repo"));
const bag_repo_1 = __importDefault(require("../Repo/bag.repo")); // (Import Repo ที่แก้ไขแล้ว)
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo"));
class bagService {
    static getBookletsInBag(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { campaignId, sessionId, bagNo } = params;
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const rows = yield booklets_repo_1.default.findByCampaignSessionAndBag(connection, campaignId, sessionId, bagNo);
                return rows.map((r) => ({
                    id: r.booklet_id,
                    sessionId: r.session_id,
                    random_num: r.random_num,
                    bagNo: r.bag_no,
                    seqInBag: r.seq_in_bag,
                    status: r.status,
                    userCode: r.user_code,
                    fullName: r.full_name,
                    qrPayload: r.qr_payload,
                    created_at: r.created_at
                }));
            }
            finally {
                connection.release();
            }
        });
    }
    static getBookScannedCount(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { campaignId } = params;
            const connection = yield DB_1.DB.getInstance().getConnection();
            try {
                const rows = (yield bag_repo_1.default.findScannCountByCampaign(connection, campaignId)) || [];
                return rows;
            }
            finally {
                connection.release();
            }
        });
    }
}
exports.bagService = bagService;
_a = bagService;
/**
 * [POST] สร้างถุง (Bulk)
 */
bagService.bulkCreate = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        const bagsToCreateRepo = [];
        const bagsToReturnRedux = [];
        const sessionIdInt = parseInt(payload.sessionId, 10);
        const maxNo = yield bag_repo_1.default.getMaxBagNoForSession(sessionIdInt, connection);
        const startNo = maxNo + 1;
        for (let i = 0; i < payload.count; i++) {
            const bagNoInt = startNo + i;
            const bagIdString = String(bagNoInt);
            // สำหรับ DB
            bagsToCreateRepo.push({
                session_id: sessionIdInt,
                bag_no: bagNoInt,
                count_items: payload.capacity,
                status: "draft",
            });
            // สำหรับ Redux (ฝั่ง frontend)
            bagsToReturnRedux.push({
                id: bagIdString, // "101", "102", ...
                campaignId: payload.campaignId, // "1"
                sessionId: payload.sessionId, // "10" (แบบ string ตามเดิม)
                sessionLabel: payload.sessionLabel,
                capacity: payload.capacity,
                scanned: [],
                status: "draft",
                // ถ้าอยากเก็บเลขจริงแยกด้วยก็เพิ่ม field bagNo: bagNoInt ได้
            });
        }
        yield bag_repo_1.default.bulkCreate(bagsToCreateRepo, connection);
        yield connection.commit();
        return bagsToReturnRedux;
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (Bulk Create Bags):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
/**
 * [POST] Finalize และ Link Booklets (สมองหลัก)
 */
// static InsertBooklets = async (payload: InsertBookletsPayload) => {
//     const connection = await DB.getInstance().getConnection();
//     try {
//         await connection.beginTransaction();
//         const campaignIdNum = parseInt(payload.campaignId, 10);
//         const bagNo = parseInt(payload.bag_no, 10);
//         // 1) หา bag จริงใน DB จาก campaign + bag_no
//         const bagRow = await bagRepo.findByCampaignAndBagNo(
//             connection,
//             campaignIdNum,
//             bagNo
//         );
//         console.log(bagRow)
//         if (!bagRow) {
//             throw new Error("ไม่พบถุงในแคมเปญนี้");
//         }
//         console.log(bagRow)
//         const bagDbId = bagRow.id;
//         const sessionId = Number(bagRow.session_id);
//         const results: ApiBookletLinked[] = [];
//         let seq = 1
//         for (const qr of payload.scannedCodes) {
//             // 2.1 ถอด QR → ได้ { cid, sid, uid }
//             const decoded = await keyService.decryptQrPayload(qr, campaignIdNum);
//             // decoded: { cid: number; sid: number; uid: string }
//             if (decoded.cid !== campaignIdNum) {
//                 throw new Error(
//                     `QR ไม่ตรงกับแคมเปญ (cid=${decoded.cid}, current=${campaignIdNum})`
//                 );
//             }
//             if (decoded.sid !== sessionId) {
//                 throw new Error(
//                     `QR ไม่ตรงกับ session ของถุงนี้ (sid=${decoded.sid}, sessionId=${sessionId})`
//                 );
//             }
//             // 2.2 หา user_session จาก cid + sid + uid
//             const userSession = await userSessionsRepo.findUserSessionByCampaignSessionAndUserCode(
//                 connection,
//                 {
//                     campaignId: campaignIdNum,
//                     sessionId,
//                     userCode: decoded.uid,   // user_code, ไม่ใช่ id
//                 }
//             );
//             if (!userSession) {
//                 throw new Error(`ไม่พบ user_session ของผู้เข้าสอบ ${decoded.uid}`);
//             }
//             console.log(bagDbId)
//             const bookletId = await bookletsRepo.insertOne(connection, {
//                 sessionId,
//                 userSessionId: userSession.id,
//                 bagNo,
//                 seqInBag: seq,
//                 status: "CREATED", // ตามรูปที่คุณใช้ตอนแพ็คถุง
//             });
//             console.log("bookletId:", bookletId);
//             console.log("lnw", bagNo, sessionId)
//             await bagRepo.updateStatus(bagNo, "SEALED", sessionId, connection)
//             results.push({
//                 id: bookletId,
//                 sessionId,
//                 bagNo,
//                 userSessionId: userSession.id,
//                 seqInBag: seq,
//                 userCode: userSession.user_code,
//             });
//             seq++;
//         }
//         await connection.commit();
//         return results;
//     } catch (error) {
//         await connection.rollback();
//         console.error("Service Error (Finalize & Link):", error);
//         throw error;
//     } finally {
//         connection.release();
//     }
// };
bagService.getAllByCampaignId = (campaignId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        const dbBags = yield bag_repo_1.default.findAllByCampaignId(campaignId, connection);
        console.log(dbBags);
        const reduxBags = dbBags.map(dbBag => {
            var _b;
            return {
                // จะใช้ id = bag_no หรือ id = b.id แล้วแต่ดีไซน์คุณ
                id: dbBag.id, // แนะนำใช้ pk จริง
                bag_no: dbBag.bag_no,
                campaignId: dbBag.campaign_id,
                sessionId: dbBag.session_id,
                sessionLabel: dbBag.session_label,
                capacity: dbBag.count_items,
                scanned: dbBag.scanned_payloads, // frontend local state
                status: dbBag.status,
                scannedCount: (_b = dbBag.scanned_count) !== null && _b !== void 0 ? _b : 0, //  อันใหม่
            };
        });
        return reduxBags;
    }
    catch (error) {
        console.error("Service Error (Get All Bags):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
bagService.CreateBagAndInsertBooklets = (campaign_id, payload, datetime) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        console.log(datetime);
        if (payload.length !== datetime.length) {
            throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
        }
        let sessionId = null;
        const results = [];
        let sessionlabel;
        // 1️⃣ decode + validate ทั้งหมดก่อน
        const decodedList = [];
        for (const qr of payload) {
            const decoded = yield key_service_1.keyService.decryptQrPayload(qr, campaign_id);
            if (decoded.cid !== campaign_id) {
                throw new Error(`QR ไม่ตรง campaign`);
            }
            if (sessionId === null) {
                sessionId = decoded.sid;
            }
            else if (decoded.sid !== sessionId) {
                throw new Error(`QR ต่าง session`);
            }
            decodedList.push(decoded);
        }
        if (!sessionId) {
            throw new Error("ไม่พบ session");
        }
        // 2️⃣ สร้างถุงครั้งเดียว
        const maxNo = yield bag_repo_1.default.getMaxBagNoForSession(sessionId, connection);
        const bagResult = yield bag_repo_1.default.CreateBagByConnection(sessionId, maxNo + 1, connection);
        const bagId = bagResult.insertId;
        console.log("Created Bag ID:", bagId);
        const day_no_payload = yield booklets_repo_1.default.getDayno(connection, sessionId);
        const dataNo = (day_no_payload === null || day_no_payload === void 0 ? void 0 : day_no_payload.day_no) || 0;
        if (dataNo === 0) {
            throw new Error("ไม่พบวันที่สอบ");
        }
        let currentRunningNumber = 0;
        const latestRecord = yield booklets_repo_1.default.getLatestRandomNumForUpdate(connection, sessionId);
        if (latestRecord === null || latestRecord === void 0 ? void 0 : latestRecord.random_num) {
            // เอา 4 ตัวท้ายเสมอ
            const runningString = latestRecord.random_num.slice(-4);
            currentRunningNumber = parseInt(runningString, 10) || 0;
        }
        // 3️⃣ insert booklets
        let seq = 1;
        for (let i = 0; i < decodedList.length; i++) {
            const decoded = decodedList[i];
            const scannedAt = datetime[i]; //  ตัวนี้แหละ
            const userSession = yield user_session_repo_1.default.findUserSessionByCampaignSessionAndUserCode(connection, {
                campaignId: campaign_id,
                sessionId,
                userCode: decoded.uid,
            });
            if (!userSession) {
                throw new Error(`ไม่พบ user_session ${decoded.uid}`);
            }
            currentRunningNumber++; // บวก 1 ในแต่ละรอบของลูป
            // ทำให้เป็น 4 หลักเสมอ
            const paddedRunning = String(currentRunningNumber).padStart(4, '0');
            // เอา dataNo มาต่อหน้า
            const nextRandomNum = `${dataNo}${paddedRunning}`;
            const bookletId = yield booklets_repo_1.default.insertOne(connection, {
                sessionId,
                userSessionId: userSession.id,
                bagNo: bagId,
                seqInBag: seq,
                status: "CREATED",
                created_at: scannedAt,
                random_num: nextRandomNum
            });
            results.push({
                id: bookletId,
                sessionId,
                bagNo: bagId,
                userSessionId: userSession.id,
                seqInBag: seq,
                userCode: userSession.user_code,
                random_num: nextRandomNum
            });
            seq++;
        }
        yield connection.commit();
        return {
            bagId,
            campaign_id,
            bagNo: maxNo + 1,
        };
    }
    catch (error) {
        yield connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
});
bagService.deleteById = (bagId) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        // (TODO: ควรเช็คว่ามี Booklets ในถุงนี้หรือไม่ก่อนลบ)
        // (สมมติว่า Repo ใช้ 'bagId' (String))
        yield bag_repo_1.default.deleteById(bagId, connection);
        yield connection.commit();
        return { bagId: bagId };
    }
    catch (error) {
        yield connection.rollback();
        console.error("Service Error (Delete Bag):", error);
        throw error;
    }
    finally {
        connection.release();
    }
});
bagService.CheckbookletsSubjects = (campaign_id, payload, datetime) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        //console.log(datetime)
        if (payload.length !== datetime.length) {
            throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
        }
        let sessionId = null;
        const results = [];
        let sessionlabel;
        // 1️⃣ decode + validate ทั้งหมดก่อน
        const decodedList = [];
        for (const qr of payload) {
            const decoded = yield key_service_1.keyService.decryptQrPayload(qr, campaign_id);
            if (decoded.cid !== campaign_id) {
                throw new Error(`QR ไม่ตรง campaign`);
            }
            if (sessionId === null) {
                sessionId = decoded.sid;
            }
            else if (decoded.sid !== sessionId) {
                throw new Error(`QR ต่าง session`);
            }
            decodedList.push(decoded);
        }
        if (!sessionId) {
            throw new Error("ไม่พบ session");
        }
        const subjectResult = yield bag_repo_1.default.CheckSubjectBooks(sessionId);
        // 2️⃣ สร้างถุงครั้งเดียว
        const maxNo = yield bag_repo_1.default.getMaxBagNoForSession(sessionId, connection);
        // const bagResult = await bagRepo.CreateBagByConnection(
        //     sessionId,
        //     maxNo + 1,
        //     connection
        // );
        // const bagId = bagResult.insertId;
        // console.log("Created Bag ID:", bagId);
        // // 3️⃣ insert booklets
        // let seq = 1;
        // for (let i = 0; i < decodedList.length; i++) {
        //     const decoded = decodedList[i];
        //     const scannedAt = datetime[i]; // 👈 ตัวนี้แหละ
        //     const userSession =
        //         await userSessionsRepo.findUserSessionByCampaignSessionAndUserCode(
        //             connection,
        //             {
        //                 campaignId: campaign_id,
        //                 sessionId,
        //                 userCode: decoded.uid,
        //             }
        //         );
        //     if (!userSession) {
        //         throw new Error(`ไม่พบ user_session ${decoded.uid}`);
        //     }
        //     const bookletId = await bookletsRepo.insertOne(connection, {
        //         sessionId,
        //         userSessionId: userSession.id,
        //         bagNo: bagId,
        //         seqInBag: seq,
        //         status: "CREATED",
        //         created_at: scannedAt,       
        //     });
        //     results.push({
        //         id: bookletId,
        //         sessionId,
        //         bagNo: bagId,
        //         userSessionId: userSession.id,
        //         seqInBag: seq,
        //         userCode: userSession.user_code,
        //     });
        //     seq++;
        // }
        yield connection.commit();
        return {
            success: true,
            subject_name: subjectResult,
            bagNo: maxNo + 1,
        };
    }
    catch (error) {
        yield connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
});

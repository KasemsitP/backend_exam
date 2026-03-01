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
const bag_repo_1 = __importDefault(require("../Repo/bag.repo")); // (Import Repo ที่แก้ไขแล้ว)
const booklets_repo_1 = __importDefault(require("../Repo/booklets.repo"));
const campaign_repo_1 = __importDefault(require("../Repo/campaign.repo"));
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
                    qrPayload: r.qr_payload ? key_service_1.keyService.maskQrPayload(r.qr_payload) : null,
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
bagService.CreateBagAndUpdateBooklets = (campaign_id, payload, // QR ที่สวมหน้ากากมาจากกระดาษ
datetime, expected_bag_no) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        yield connection.beginTransaction();
        if (payload.length !== datetime.length)
            throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
        if (payload.length === 0)
            throw new Error("ไม่มีข้อมูล QR Code");
        //   ถอดหน้ากากให้เป็น Payload ตัวจริง (แต่ยังไม่ได้ Decrypt หาตัวตนนักศึกษานะ!)
        const realPayloads = payload.map(scannedQr => key_service_1.keyService.unmaskQrPayload(scannedQr));
        console.log("Real Payloads (Unmasked):", realPayloads);
        // ดึงข้อมูลเล่มข้อสอบจาก Database ด้วย Payload ตัวจริง
        const existingBooklets = yield booklets_repo_1.default.findByPayloads(connection, realPayloads);
        if (existingBooklets.length !== realPayloads.length) {
            throw new Error("พบ QR Code ที่ไม่ได้อยู่ในระบบ (อาจเป็นของรอบสอบอื่นหรือสแกนผิดพลาด)");
        }
        //  ตรวจสอบ Validate จากข้อมูลตาราง booklets โดยตรง
        let sessionId = null;
        for (const booklet of existingBooklets) {
            // เช็คว่าเป็นวิชา/รอบสอบ เดียวกันทั้งหมดไหม
            if (sessionId === null) {
                sessionId = booklet.session_id;
            }
            else if (booklet.session_id !== sessionId) {
                throw new Error(`ไม่อนุญาตให้จัดข้อสอบต่างวิชา (Session) ลงในถุงเดียวกัน`);
            }
            // เช็คว่าเล่มนี้โดนจัดลงถุงไปหรือยัง
            if (booklet.bag_id !== null) {
                throw new Error("มีเล่มข้อสอบบางเล่มถูกจัดลงถุงอื่นไปแล้ว โปรดตรวจสอบอีกครั้ง");
            }
        }
        if (!sessionId)
            throw new Error("ไม่พบ session");
        // 💡 (Optional) ถ้าคุณต้องการเช็คให้ชัวร์ว่า Session นี้อยู่ใน Campaign นี้จริงๆ
        // const sessionData = await sessionRepo.findById(connection, sessionId);
        // if (sessionData.campaign_id !== campaign_id) throw new Error("QR ไม่ตรง Campaign");
        const isValidSession = yield campaign_repo_1.default.verifySessionInCampaign(connection, sessionId, campaign_id);
        if (!isValidSession) {
            throw new Error("ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบรอบสอบหรือวันที่สอบปัจจุบัน กรุณาตรวจสอบให้แน่ใจว่าไม่ได้หยิบข้อสอบผิดกอง");
        }
        // ==========================================
        // 3️⃣ หาเลขถุงที่แหว่งไป และสร้างถุงใหม่
        // ==========================================
        const existingBagNos = yield bag_repo_1.default.getAllBagNumbersForSession(sessionId, connection);
        let targetBagNo = 1;
        existingBagNos.sort((a, b) => a - b);
        for (const no of existingBagNos) {
            if (no === targetBagNo)
                targetBagNo++;
            else
                break;
        }
        if (targetBagNo !== expected_bag_no) {
            throw new Error(`มีผู้ใช้สร้างหมายเลขถุง ${expected_bag_no} ไปแล้ว กรุณากดยืนยันอีกครั้งเพื่อรับหมายเลขถุงใหม่`);
        }
        const bagResult = yield bag_repo_1.default.CreateBagByConnection(sessionId, targetBagNo, connection);
        const bagId = bagResult.insertId;
        // ==========================================
        // 4️⃣ Update Booklets (จับยัดลงถุง)
        // ==========================================
        const day_no_payload = yield booklets_repo_1.default.getDayno(connection, sessionId);
        const dataNo = (day_no_payload === null || day_no_payload === void 0 ? void 0 : day_no_payload.day_no) || 0;
        if (dataNo === 0)
            throw new Error("ไม่พบวันที่สอบ");
        const latestRecord = yield booklets_repo_1.default.getLatestRandomNumForUpdate(connection, sessionId);
        let currentRunningNumber = (latestRecord === null || latestRecord === void 0 ? void 0 : latestRecord.random_num) ? parseInt(latestRecord.random_num.slice(-4), 10) : 0;
        const updatePromises = [];
        for (let i = 0; i < realPayloads.length; i++) {
            const rawQrPayload = realPayloads[i];
            currentRunningNumber++;
            const paddedRunning = String(currentRunningNumber).padStart(4, '0');
            const nextRandomNum = `${dataNo}${paddedRunning}`;
            const seq = i + 1;
            const status = 'PACKAGED';
            updatePromises.push(booklets_repo_1.default.updateBagInfoByPayload(connection, rawQrPayload, // ส่งตัวจริงไป Update
            bagId, seq, status, nextRandomNum));
        }
        yield Promise.all(updatePromises);
        yield connection.commit();
        return {
            bagId,
            campaign_id,
            bagNo: targetBagNo,
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
bagService.CheckbookletsSubjects = (campaign_id, payload, // รับค่าที่สวมหน้ากากมาจากเครื่องสแกน
datetime) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield DB_1.DB.getInstance().getConnection();
    try {
        if (payload.length !== datetime.length) {
            throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
        }
        if (payload.length === 0) {
            throw new Error("ไม่มีข้อมูล QR Code");
        }
        // 🛑 1️⃣ ถอดหน้ากาก (Unmask) ก่อนเพื่อเอาไปค้นหาใน DB
        const realPayloads = payload.map(qr => key_service_1.keyService.unmaskQrPayload(qr));
        // ==========================================
        // ❌ เอา Parallel Decode (decryptQrPayloadBags) ออก
        // เปลี่ยนมาใช้การหาข้อมูลเล่มข้อสอบจาก Database ตรงๆ เพื่อความเป็น Blind 100%
        // ==========================================
        const existingBooklets = yield booklets_repo_1.default.findByPayloads(connection, realPayloads);
        if (existingBooklets.length !== realPayloads.length) {
            throw new Error("พบ QR Code ที่ไม่ได้อยู่ในระบบ (อาจเป็นของรอบสอบอื่นหรือสแกนผิดพลาด)");
        }
        let sessionId = null;
        for (const booklet of existingBooklets) {
            // ตรวจสอบว่าเป็น Session เดียวกันทั้งหมด
            if (sessionId === null) {
                sessionId = booklet.session_id;
            }
            else if (booklet.session_id !== sessionId) {
                throw new Error(`ไม่อนุญาตให้สแกนข้อสอบต่างวิชา (Session) ปะปนกัน`);
            }
            // สามารถเช็คดักเพิ่มได้ด้วยว่ามีเล่มไหนจัดลงถุงไปแล้วหรือยัง
            if (booklet.bag_id !== null) {
                throw new Error("มีเล่มข้อสอบบางเล่มถูกจัดลงถุงอื่นไปแล้ว โปรดนำออกก่อนสแกนตรวจสอบ");
            }
        }
        if (!sessionId)
            throw new Error("ไม่พบ session");
        // 💡 (Optional) เช็ค Campaign ให้ชัวร์ว่า Session นี้ตรงกับ Campaign ปัจจุบัน
        // const isValidSession = await sessionRepo.verifySessionInCampaign(connection, sessionId, campaign_id);
        // if (!isValidSession) throw new Error("ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบปัจจุบัน");
        const isValidSession = yield campaign_repo_1.default.verifySessionInCampaign(connection, sessionId, campaign_id);
        if (!isValidSession) {
            throw new Error("ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบรอบสอบหรือวันที่สอบปัจจุบัน กรุณาตรวจสอบให้แน่ใจว่าไม่ได้หยิบข้อสอบผิดกอง");
        }
        // 2️⃣ เช็ควิชา
        const subjectResult = yield bag_repo_1.default.CheckSubjectBooks(sessionId);
        // ==========================================
        // 3️⃣ หาเลขถุงที่แหว่งไป (แค่หาเฉยๆ ไม่สร้าง!)
        // ==========================================
        const existingBagNos = yield bag_repo_1.default.getAllBagNumbersForSession(sessionId, connection);
        let targetBagNo = 1;
        existingBagNos.sort((a, b) => a - b);
        for (const no of existingBagNos) {
            if (no === targetBagNo)
                targetBagNo++;
            else
                break;
        }
        // คืนค่าเฉพาะเลขถุงคาดการณ์ และชื่อวิชา
        return {
            success: true,
            subject_name: subjectResult,
            bagNo: targetBagNo,
        };
    }
    catch (error) {
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
        yield booklets_repo_1.default.deleteByBagId(connection, bagId);
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

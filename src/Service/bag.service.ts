import { DB } from "../model/DB";
import { keyService } from "./key.service";
import userSessionsRepo from "../Repo/user-session.repo";
import bagRepo from "../Repo/bag.repo"; // (Import Repo ที่แก้ไขแล้ว)
import bookletsRepo from "../Repo/booklets.repo";
import { DbBookletInBagRow } from "../Repo/booklets.repo";
import { BagScannedCountResult } from "../Repo/bag.repo";
import campaignRepo from "../Repo/campaign.repo";

// (Interface จาก Frontend)
interface BulkCreatePayload {
    campaignId: string;
    sessionId: string; // (e.g., "sess-10")
    sessionLabel: string;
    prefix: string; // (e.g., "BAG-")
    count: number;
    capacity: number; // (e.g., 30)
}

interface InsertBookletsPayload {
    campaignId: string;
    bag_no: string; // (e.g., "BAG-001")
    scannedCodes: string[];
}
export interface ApiBookletLinked {
    id?: number;
    sessionId: number;
    bagNo: number;
    userSessionId: number;
    seqInBag: number;
    userCode: string;
    random_num: string;
}

export interface ApiBagBooklet {
    id: number;
    sessionId: number;
    bagNo: number;
    seqInBag: number | null;
    status: string;
    userCode: string;
    fullName: string;
    qrPayload: string | null;
    random_num: string;
}

export class bagService {

    /**
     * [POST] สร้างถุง (Bulk)
     */
    static bulkCreate = async (payload: BulkCreatePayload) => {
        const connection = await DB.getInstance().getConnection();
        try {
            await connection.beginTransaction();

            const bagsToCreateRepo: any[] = [];
            const bagsToReturnRedux: any[] = [];

            const sessionIdInt = parseInt(payload.sessionId, 10);

            const maxNo = await bagRepo.getMaxBagNoForSession(sessionIdInt, connection);
            const startNo = maxNo + 1;

            for (let i = 0; i < payload.count; i++) {
                const bagNoInt = startNo + i;
                const bagIdString = String(bagNoInt);

                // สำหรับ DB
                bagsToCreateRepo.push({
                    session_id: sessionIdInt,
                    bag_no: bagNoInt,
                    count_items: payload.capacity,
                    status: "draft" as const,
                });

                // สำหรับ Redux (ฝั่ง frontend)
                bagsToReturnRedux.push({
                    id: bagIdString,                // "101", "102", ...
                    campaignId: payload.campaignId, // "1"
                    sessionId: payload.sessionId,   // "10" (แบบ string ตามเดิม)
                    sessionLabel: payload.sessionLabel,
                    capacity: payload.capacity,
                    scanned: [],
                    status: "draft" as const,
                    // ถ้าอยากเก็บเลขจริงแยกด้วยก็เพิ่ม field bagNo: bagNoInt ได้
                });
            }

            await bagRepo.bulkCreate(bagsToCreateRepo, connection);
            await connection.commit();
            return bagsToReturnRedux;

        } catch (error) {
            await connection.rollback();
            console.error("Service Error (Bulk Create Bags):", error);
            throw error;
        } finally {
            connection.release();
        }
    };
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
    static getAllByCampaignId = async (campaignId: string) => {
        const connection = await DB.getInstance().getConnection();
        try {
            const dbBags = await bagRepo.findAllByCampaignId(campaignId, connection);
            console.log(dbBags)

            const reduxBags = dbBags.map(dbBag => {
                return {
                    // จะใช้ id = bag_no หรือ id = b.id แล้วแต่ดีไซน์คุณ
                    id: dbBag.id,                             // แนะนำใช้ pk จริง
                    bag_no: dbBag.bag_no,
                    campaignId: dbBag.campaign_id,
                    sessionId: dbBag.session_id,
                    sessionLabel: dbBag.session_label,
                    capacity: dbBag.count_items,
                    scanned: dbBag.scanned_payloads,                              // frontend local state
                    status: dbBag.status,
                    scannedCount: dbBag.scanned_count ?? 0,   //  อันใหม่
                };

            });

            return reduxBags;

        } catch (error) {
            console.error("Service Error (Get All Bags):", error);
            throw error;
        } finally {
            connection.release();
        }
    };


    static CreateBagAndUpdateBooklets = async (
        campaign_id: number,
        payload: string[], // QR ที่สวมหน้ากากมาจากกระดาษ
        datetime: Date[],
        expected_bag_no: number,
    ) => {
        const connection = await DB.getInstance().getConnection();

        try {
            await connection.beginTransaction();

            if (payload.length !== datetime.length) throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
            if (payload.length === 0) throw new Error("ไม่มีข้อมูล QR Code");

            //   ถอดหน้ากากให้เป็น Payload ตัวจริง (แต่ยังไม่ได้ Decrypt หาตัวตนนักศึกษานะ!)
            const realPayloads = payload.map(scannedQr => keyService.unmaskQrPayload(scannedQr));
            console.log("Real Payloads (Unmasked):", realPayloads);

            // ดึงข้อมูลเล่มข้อสอบจาก Database ด้วย Payload ตัวจริง
            const existingBooklets = await bookletsRepo.findByPayloads(connection, realPayloads);

            if (existingBooklets.length !== realPayloads.length) {
                throw new Error("พบ QR Code ที่ไม่ได้อยู่ในระบบ (อาจเป็นของรอบสอบอื่นหรือสแกนผิดพลาด)");
            }
            const sessInCamp = await campaignRepo.sessioninCampaign(campaign_id, connection);
            console.log(campaign_id)
            console.log("sessInCamp:", sessInCamp);

            //  ตรวจสอบ Validate จากข้อมูลตาราง booklets โดยตรง
            let sessionId: number | null = null;

            for (const booklet of existingBooklets) {
                // เช็คว่าเป็นวิชา/รอบสอบ เดียวกันทั้งหมดไหม
                if (sessionId === null) {
                    sessionId = booklet.session_id;
                } else if (booklet.session_id !== sessionId) {
                    throw new Error(`ไม่อนุญาตให้จัดข้อสอบต่างวิชา (Session) ลงในถุงเดียวกัน`);
                }
                
                if (!sessInCamp.some(s => s.session_id === booklet.session_id)) {
                    throw new Error(`ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบปัจจุบัน`);
                }

                // เช็คว่าเล่มนี้โดนจัดลงถุงไปหรือยัง
                if (booklet.bag_id !== null) {
                    throw new Error("มีเล่มข้อสอบบางเล่มถูกจัดลงถุงอื่นไปแล้ว โปรดตรวจสอบอีกครั้ง");
                }
            }

            if (!sessionId) throw new Error("ไม่พบ session");

            // 💡 (Optional) ถ้าคุณต้องการเช็คให้ชัวร์ว่า Session นี้อยู่ใน Campaign นี้จริงๆ
            // const sessionData = await sessionRepo.findById(connection, sessionId);
            // if (sessionData.campaign_id !== campaign_id) throw new Error("QR ไม่ตรง Campaign");
            const isValidSession = await campaignRepo.verifySessionInCampaign(connection, sessionId, campaign_id)
            if (!isValidSession) {
                throw new Error("ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบรอบสอบหรือวันที่สอบปัจจุบัน กรุณาตรวจสอบให้แน่ใจว่าไม่ได้หยิบข้อสอบผิดกอง");
            }
            // ==========================================
            // 3️⃣ หาเลขถุงที่แหว่งไป และสร้างถุงใหม่
            // ==========================================
            const existingBagNos = await bagRepo.getAllBagNumbersForSession(sessionId, connection);
            let targetBagNo = 1;
            existingBagNos.sort((a, b) => a - b);
            for (const no of existingBagNos) {
                if (no === targetBagNo) targetBagNo++;
                else break;
            }

            if (targetBagNo !== expected_bag_no) {
                throw new Error(`มีผู้ใช้สร้างหมายเลขถุง ${expected_bag_no} ไปแล้ว กรุณากดยืนยันอีกครั้งเพื่อรับหมายเลขถุงใหม่`);
            }

            const bagResult = await bagRepo.CreateBagByConnection(sessionId, targetBagNo, connection);
            const bagId = bagResult.insertId;

            // ==========================================
            // 4️⃣ Update Booklets (จับยัดลงถุง)
            // ==========================================
            const day_no_payload = await bookletsRepo.getDayno(connection, sessionId);
            const dataNo = day_no_payload?.day_no || 0;
            if (dataNo === 0) throw new Error("ไม่พบวันที่สอบ");

            const latestRecord = await bookletsRepo.getLatestRandomNumForUpdate(connection, sessionId);
            let currentRunningNumber = latestRecord?.random_num ? parseInt(latestRecord.random_num.slice(-4), 10) : 0;

            const updatePromises = [];

            for (let i = 0; i < realPayloads.length; i++) {
                const rawQrPayload = realPayloads[i];
                currentRunningNumber++;
                const paddedRunning = String(currentRunningNumber).padStart(4, '0');
                const nextRandomNum = `${dataNo}${paddedRunning}`;
                const seq = i + 1;
                const status = 'PACKAGED';

                updatePromises.push(
                    bookletsRepo.updateBagInfoByPayload(
                        connection,
                        rawQrPayload, // ส่งตัวจริงไป Update
                        bagId,
                        seq,
                        status,
                        nextRandomNum,
                        datetime[i]
                    )
                );
            }

            await Promise.all(updatePromises);
            await connection.commit();

            return {
                bagId,
                campaign_id,
                bagNo: targetBagNo,
            };

        } catch (error: any) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    };
    static CheckbookletsSubjects = async (
        campaign_id: number,
        payload: string[], // รับค่าที่สวมหน้ากากมาจากเครื่องสแกน
        datetime: Date[]
    ) => {

        const started = Date.now();

        console.log("[CheckbookletsSubjects] start", {
            campaign_id,
            payloadCount: payload?.length,
            datetimeCount: datetime?.length,
        });
        const connection = await DB.getInstance().getConnection();
        console.log("[CheckbookletsSubjects] got connection", Date.now() - started, "ms");

        try {
            if (payload.length !== datetime.length) {
                throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
            }
            if (payload.length === 0) {
                throw new Error("ไม่มีข้อมูล QR Code");
            }

            // 🛑 1️⃣ ถอดหน้ากาก (Unmask) ก่อนเพื่อเอาไปค้นหาใน DB
            const realPayloads = payload.map(qr => keyService.unmaskQrPayload(qr));
             console.log("[CheckbookletsSubjects] unmask done", Date.now() - started, "ms");

            // ==========================================
            //  เอา Parallel Decode (decryptQrPayloadBags) ออก
            // เปลี่ยนมาใช้การหาข้อมูลเล่มข้อสอบจาก Database ตรงๆ เพื่อความเป็น Blind 100%
            // ==========================================
            const existingBooklets = await bookletsRepo.findByPayloads(connection, realPayloads);
             console.log("[CheckbookletsSubjects] findByPayloads done", Date.now() - started, "ms");

            if (existingBooklets.length !== realPayloads.length) {
                throw new Error("พบ QR Code ที่ไม่ได้อยู่ในระบบ (อาจเป็นของรอบสอบอื่นหรือสแกนผิดพลาด)");
            }
            
            const sessInCamp = await campaignRepo.sessioninCampaign(campaign_id, connection);
            console.log(campaign_id)
            console.log("sessInCamp:", sessInCamp);

            let sessionId: number | null = null;
            for (const booklet of existingBooklets) {
                // ตรวจสอบว่าเป็น Session เดียวกันทั้งหมด
                if (sessionId === null) {
                    sessionId = booklet.session_id;
                } else if (booklet.session_id !== sessionId) {
                    throw new Error(`ไม่อนุญาตให้สแกนข้อสอบต่างวิชา (Session) ปะปนกัน`);
                }

                if (!sessInCamp.some(s => s.session_id === booklet.session_id)) {
                    throw new Error(`ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบปัจจุบัน`);
                }

                // สามารถเช็คดักเพิ่มได้ด้วยว่ามีเล่มไหนจัดลงถุงไปแล้วหรือยัง
                if (booklet.bag_id !== null) {
                    throw new Error("มีเล่มข้อสอบบางเล่มถูกจัดลงถุงอื่นไปแล้ว โปรดนำออกก่อนสแกนตรวจสอบ");
                }
            }

            if (!sessionId) throw new Error("ไม่พบ session");

            // 💡 (Optional) เช็ค Campaign ให้ชัวร์ว่า Session นี้ตรงกับ Campaign ปัจจุบัน
            // const isValidSession = await sessionRepo.verifySessionInCampaign(connection, sessionId, campaign_id);
            // if (!isValidSession) throw new Error("ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบปัจจุบัน");
            const isValidSession = await campaignRepo.verifySessionInCampaign(connection, sessionId, campaign_id)
            console.log("[CheckbookletsSubjects] verifySessionInCampaign done", Date.now() - started, "ms");
            if (!isValidSession) {
                throw new Error("ข้อสอบที่สแกนไม่ได้อยู่ในรอบสอบรอบสอบหรือวันที่สอบปัจจุบัน กรุณาตรวจสอบให้แน่ใจว่าไม่ได้หยิบข้อสอบผิดกอง");
            }

            // 2️⃣ เช็ควิชา
            const subjectResult = await bagRepo.CheckSubjectBooksConn(sessionId, connection);
            console.log("[CheckbookletsSubjects] CheckSubjectBooks done", Date.now() - started, "ms");

            // ==========================================
            // 3️⃣ หาเลขถุงที่แหว่งไป (แค่หาเฉยๆ ไม่สร้าง!)
            // ==========================================
            const existingBagNos = await bagRepo.getAllBagNumbersForSession(sessionId, connection);
             console.log("[CheckbookletsSubjects] getAllBagNumbersForSession done", Date.now() - started, "ms");

            let targetBagNo = 1;
            existingBagNos.sort((a, b) => a - b);
            for (const no of existingBagNos) {
                if (no === targetBagNo) targetBagNo++;
                else break;
            }
            console.log("[CheckbookletsSubjects] success", Date.now() - started, "ms");
            // คืนค่าเฉพาะเลขถุงคาดการณ์ และชื่อวิชา
            return {
                success: true,
                subject_name: subjectResult,
                bagNo: targetBagNo,
            };
        } catch (error) {
            throw error;
        } finally {
            connection.release();
        }
    };
    static deleteById = async (bagId: number) => {
        const connection = await DB.getInstance().getConnection();
        try {
            await connection.beginTransaction();


            await bookletsRepo.deleteByBagId(connection, bagId);
            await bagRepo.deleteById(bagId, connection);

            await connection.commit();
            return { bagId: bagId };

        } catch (error) {
            await connection.rollback();
            console.error("Service Error (Delete Bag):", error);
            throw error;
        } finally {
            connection.release();
        }
    };
    static async getBookletsInBag(params: {
        campaignId: number;
        sessionId: number;
        bagNo: number;
    }): Promise<ApiBagBooklet[]> {
        const { campaignId, sessionId, bagNo } = params;
        const connection = await DB.getInstance().getConnection();

        try {
            const rows: DbBookletInBagRow[] =
                await bookletsRepo.findByCampaignSessionAndBag(
                    connection,
                    campaignId,
                    sessionId,
                    bagNo
                );

            return rows.map((r) => ({
                id: r.booklet_id,
                sessionId: r.session_id,
                random_num: r.random_num,
                bagNo: r.bag_no,
                seqInBag: r.seq_in_bag,
                status: r.status,
                userCode: r.user_code,
                fullName: r.full_name,

                qrPayload: r.qr_payload ? keyService.maskQrPayload(r.qr_payload) : null,

                created_at: r.created_at
            }));
        } finally {
            connection.release();
        }
    }
    static async getBookScannedCount(params: {
        campaignId: number;
    }): Promise<BagScannedCountResult[]> {
        const { campaignId } = params;
        const connection = await DB.getInstance().getConnection();

        try {
            const rows: BagScannedCountResult[] =
                (await bagRepo.findScannCountByCampaign(connection, campaignId)) || [];

            return rows

        } finally {
            connection.release();
        }
    }


}


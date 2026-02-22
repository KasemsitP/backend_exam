import { DB } from "../model/DB";
import { keyService } from "./key.service";
import userSessionsRepo from "../Repo/user-session.repo";
import bagRepo from "../Repo/bag.repo"; // (Import Repo ที่แก้ไขแล้ว)
import bookletsRepo from "../Repo/booklets.repo";
import { DbBookletInBagRow } from "../Repo/booklets.repo";
import { BagScannedCountResult } from "../Repo/bag.repo";

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
    id: number;
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


    static CreateBagAndInsertBooklets = async (
        campaign_id: number,
        payload: string[],
        datetime: Date[]
    ) => {
        const connection = await DB.getInstance().getConnection();

        try {
            await connection.beginTransaction();

            console.log(datetime)

            if (payload.length !== datetime.length) {
                throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
            }


            let sessionId: number | null = null;
            const results: ApiBookletLinked[] = [];
            let sessionlabel;

            // 1️⃣ decode + validate ทั้งหมดก่อน
            const decodedList = [];

            for (const qr of payload) {
                const decoded = await keyService.decryptQrPayload(qr, campaign_id);

                if (decoded.cid !== campaign_id) {
                    console.log("decoded.cid:", decoded.cid, "campaign_id:", campaign_id)
                    throw new Error(`QR ไม่ตรง campaign`);
                }

                if (sessionId === null) {
                    sessionId = decoded.sid;
                } else if (decoded.sid !== sessionId) {
                    throw new Error(`QR ต่าง session`);
                }

                decodedList.push(decoded);
            }

            if (!sessionId) {
                throw new Error("ไม่พบ session");
            }

            // 2️⃣ สร้างถุงครั้งเดียว
            const maxNo = await bagRepo.getMaxBagNoForSession(sessionId, connection);
            const bagResult = await bagRepo.CreateBagByConnection(
                sessionId,
                maxNo + 1,
                connection
            );

            const bagId = bagResult.insertId;

            console.log("Created Bag ID:", bagId);

            const day_no_payload = await bookletsRepo.getDayno(connection, sessionId)
            const dataNo = day_no_payload?.day_no || 0
            if (dataNo === 0) {
                throw new Error("ไม่พบวันที่สอบ");
            }
            let currentRunningNumber = 0;
            const latestRecord = await bookletsRepo.getLatestRandomNumForUpdate(connection, sessionId);

            if (latestRecord?.random_num) {
                // เอา 4 ตัวท้ายเสมอ
                const runningString = latestRecord.random_num.slice(-4);
                currentRunningNumber = parseInt(runningString, 10) || 0;
            }

            // 3️⃣ insert booklets
            let seq = 1;
            for (let i = 0; i < decodedList.length; i++) {
                const decoded = decodedList[i];
                const scannedAt = datetime[i]; //  ตัวนี้แหละ

                const userSession =
                    await userSessionsRepo.findUserSessionByCampaignSessionAndUserCode(
                        connection,
                        {
                            campaignId: campaign_id,
                            sessionId,
                            userCode: decoded.uid,
                        }
                    );

                if (!userSession) {
                    throw new Error(`ไม่พบ user_session ${decoded.uid}`);
                }

                currentRunningNumber++; // บวก 1 ในแต่ละรอบของลูป

                // ทำให้เป็น 4 หลักเสมอ
                const paddedRunning = String(currentRunningNumber).padStart(4, '0');

                // เอา dataNo มาต่อหน้า
                const nextRandomNum = `${dataNo}${paddedRunning}`;

                const bookletId = await bookletsRepo.insertOne(connection, {
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

            await connection.commit();

            return {
                bagId,
                campaign_id,
                bagNo: maxNo + 1,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    };



    static deleteById = async (bagId: string) => {
        const connection = await DB.getInstance().getConnection();
        try {
            await connection.beginTransaction();

            // (TODO: ควรเช็คว่ามี Booklets ในถุงนี้หรือไม่ก่อนลบ)
            // (สมมติว่า Repo ใช้ 'bagId' (String))
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
                qrPayload: r.qr_payload,
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

    static CheckbookletsSubjects = async (
        campaign_id: number,
        payload: string[],
        datetime: Date[]
    ) => {
        const connection = await DB.getInstance().getConnection();

        try {
            await connection.beginTransaction();

            //console.log(datetime)

            if (payload.length !== datetime.length) {
                throw new Error("จำนวน QR และ datetime ไม่ตรงกัน");
            }


            let sessionId: number | null = null;
            const results: ApiBookletLinked[] = [];
            let sessionlabel;

            // 1️⃣ decode + validate ทั้งหมดก่อน
            const decodedList = [];

            for (const qr of payload) {
                const decoded = await keyService.decryptQrPayload(qr, campaign_id);

                if (decoded.cid !== campaign_id) {
                    throw new Error(`QR ไม่ตรง campaign`);
                }

                if (sessionId === null) {
                    sessionId = decoded.sid;
                } else if (decoded.sid !== sessionId) {
                    throw new Error(`QR ต่าง session`);
                }

                decodedList.push(decoded);
            }

            if (!sessionId) {
                throw new Error("ไม่พบ session");
            }

            const subjectResult = await bagRepo.CheckSubjectBooks(sessionId)

            // 2️⃣ สร้างถุงครั้งเดียว
            const maxNo = await bagRepo.getMaxBagNoForSession(sessionId, connection);
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

            await connection.commit();

            return {
                success: true,
                subject_name: subjectResult,
                bagNo: maxNo + 1,
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    };
}


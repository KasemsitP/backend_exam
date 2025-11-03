import { DB } from "../model/DB";
import * as keyService from "./key.service"; 
import userSessionsRepo from "../Repo/user-session.repo";
import bookletRepo from "../Repo/booklet.repo"; 
import bagRepo from "../Repo/bag.repo"; // (Import Repo ที่แก้ไขแล้ว)

// (Interface จาก Frontend)
interface BulkCreatePayload {
  campaignId: string;
  sessionId: string; // (e.g., "sess-10")
  sessionLabel: string;
  subjectCode?: string;
  subjectName?: string;
  prefix: string; // (e.g., "BAG-")
  count: number;
  capacity: number; // (e.g., 30)
}

interface FinalizeLinkPayload {
  campaignId: string;
  bagId: string; // (e.g., "BAG-001")
  scannedCodes: string[];
}

export class bagService {

  /**
   * [POST] สร้างถุง (Bulk)
   */
  static bulkCreate = async (payload: BulkCreatePayload) => {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const bagsToCreateRepo = []; // (สำหรับ Repo)
      const bagsToReturnRedux = []; // (สำหรับ Redux)
      
      // ⭐️ (FIX 1) แปลง ID (String) เป็น ID (Int)
      const sessionIdInt = parseInt(payload.sessionId.replace("sess-", ""));

      for (let i = 1; i <= payload.count; i++) {
        // ⭐️ (FIX 2) สร้าง ID (String) สำหรับ Redux/Service
        const bagStringId = `${payload.prefix}${String(i).padStart(3, "0")}`;
        console.log(bagStringId)
         const bagNoInt = i;
        // ⭐️ (FIX 3) เตรียมข้อมูลสำหรับ Repo 
// (ตาม Schema)
        bagsToCreateRepo.push({
          session_id: sessionIdInt,
          bag_no: bagNoInt, // (ส่ง String ID ไปที่ bag_no)
          count_items: payload.capacity, // (ใช้ capacity)
          status: "draft" as "draft",
        });

        // ⭐️ (FIX 4) เตรียมข้อมูลสำหรับ Redux (ตาม Interface 'Bag')
        bagsToReturnRedux.push({
          id: bagStringId, // (Redux ID)
          campaignId: payload.campaignId,
          sessionId: payload.sessionId,
          sessionLabel: payload.sessionLabel,
          subjectCode: payload.subjectCode,
          subjectName: payload.subjectName,
          capacity: payload.capacity,
          scanned: [],
          status: "draft",
        });
      }

      // (ส่งข้อมูลที่ตรงกับ Schema ไปที่ Repo)
      await bagRepo.bulkCreate(bagsToCreateRepo, connection);

      await connection.commit();
      return bagsToReturnRedux; // (ส่งข้อมูลเต็มกลับไปให้ Redux)

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
  static finalizeAndLink = async (payload: FinalizeLinkPayload) => {
    const connection = await DB.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      const { campaignId, bagId, scannedCodes } = payload;
      const newBooklets = [];
      const campaignIdNumeric = parseInt(campaignId.replace("camp-", "")); 

      for (const code of scannedCodes) {
        const decryptedPayload = await keyService.keyService.decryptQrPayloadConnection(code, campaignIdNumeric, connection);
        
        if (!decryptedPayload || !decryptedPayload.uid || !decryptedPayload.sid) {
          throw new Error(`QR Code ไม่ถูกต้อง หรือถอดรหัสล้มเหลว: ${code}`);
        }

        const userSession = await userSessionsRepo.findByUserIdAndSessionId(
          decryptedPayload.uid,
          decryptedPayload.sid,
          connection
        );

        if (!userSession) {
          throw new Error(`ไม่พบ User Session ที่ตรงกับ UID: ${decryptedPayload.uid}, SID: ${decryptedPayload.sid}`);
        }

        // ⭐️ (FIX 5) ตรวจสอบ Schema 'booklets'
        // (Schema 'booklets' ต้องการ bag_no (int) แต่เรามี bagId (string "BAG-001"))
        // (Schema 'booklets' FK อ้างอิง 'bags(session_id, bag_no)')
        // (นี่คือปัญหา Schema Conflict ที่ใหญ่กว่า)
        
        // ⭐️ (ASSUMPTION) สมมติว่า 'booklets.bag_no' ถูกเปลี่ยนเป็น VARCHAR(32) เพื่อเก็บ 'BAG-001'
        newBooklets.push({
          bag_id_string: bagId, // (ส่ง String ID "BAG-001")
          user_session_id: userSession.user_session_id,
          qr_payload_raw: code,
          session_id: decryptedPayload.sid, 
          status: 'bagged',
        });
      }

      if (newBooklets.length > 0) {
        // ⭐️ (FIX 6) เราต้องแก้ bookletRepo.bulkCreate ให้รับ 'bag_id_string'
        // await bookletRepo.bulkCreate(newBooklets, connection);
        console.warn("TODO: bookletRepo.bulkCreate needs schema update (bag_no INT vs bag_id VARCHAR)");
      }

      const newStatus = "ready";
      // (Repo 'updateStatus' ถูกแก้ให้ใช้ bag_no (varchar) แล้ว)
      await bagRepo.updateStatus(bagId, newStatus, connection);

      await connection.commit();

      return {
        bagId: bagId,
        bookletsCreated: newBooklets.length,
        status: newStatus,
      };

    } catch (error) {
      await connection.rollback();
      console.error("Service Error (Finalize & Link):", error);
      throw error;
    } finally {
      connection.release();
    }
  };
 static getAllByCampaignId = async (campaignId: string) => {
    const connection = await DB.getInstance().getConnection();
    try {
      // (สมมติว่า Repo ถูกต้อง)
      const dbBags = await bagRepo.findAllByCampaignId(campaignId, connection);
      
      // (แปลง DB Row -> Redux Interface 'Bag')
      const reduxBags = dbBags.map(dbBag => {
        return {
          id: dbBag.bag_no, // (DB: 'bag_no' (VARCHAR) -> Redux: 'id')
          campaignId: dbBag.campaign_id,
          sessionId: dbBag.session_id,
          sessionLabel: dbBag.session_label,
          subjectCode: dbBag.subject_code,
          subjectName: dbBag.subject_name,
          capacity: dbBag.count_items, // (DB: 'count_items' -> Redux: 'capacity')
          scanned: [], // (การ Fetch ครั้งแรก เราไม่จำเป็นต้องส่ง Scanned)
          status: dbBag.status,
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
}


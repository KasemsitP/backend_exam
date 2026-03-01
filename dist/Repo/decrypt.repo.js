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
class DecryptRepo {
    checkUnlockPrerequisites(campaignId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            const [[{ key_count }]] = yield conn.query(`SELECT COUNT(*) AS key_count
       FROM campaign_keys
       WHERE campaign_id = ? AND active = 1`, [campaignId]);
            const [[{ uc_count }]] = yield conn.query(`SELECT COUNT(*) AS uc_count
       FROM user_campaigns
       WHERE campaign_id = ?`, [campaignId]);
            const [[{ missing_seat }]] = yield conn.query(`SELECT COUNT(*) AS missing_seat
       FROM user_campaigns
       WHERE campaign_id = ?
         AND (room_code IS NULL OR row_no IS NULL OR col_no IS NULL)`, [campaignId]);
            const [[{ pending_slots }]] = yield conn.query(`SELECT COUNT(*) AS pending_slots
       FROM grading_slots gs
       JOIN booklets b ON b.id = gs.booklet_id
       JOIN sessions s ON s.id = b.session_id
       WHERE s.campaign_id = ?
         AND b.bag_id IS NOT NULL 
         AND gs.status IN ('OPEN','ASSIGNED','DISPUTED')`, [campaignId]);
            //  NEW CASE: ตรวจสอบความผิดปกติ (สถานะเสร็จแล้ว แต่ไม่มีคะแนนจริงๆ)
            const [[{ missing_score_slots }]] = yield conn.query(`SELECT COUNT(*) AS missing_score_slots
       FROM grading_slots gs
       JOIN booklets b ON b.id = gs.booklet_id
       JOIN sessions s ON s.id = b.session_id
       LEFT JOIN grading_scores gsc ON gsc.slot_id = gs.id --  LEFT JOIN หาคะแนน
       WHERE s.campaign_id = ?
         AND b.bag_id IS NOT NULL 
         AND gs.status = 'COMPLETED'
         AND gsc.id IS NULL`, [campaignId]);
            const [[{ unbagged }]] = yield conn.query(`SELECT COUNT(*) AS unbagged
       FROM booklets b
       JOIN sessions s ON s.id = b.session_id
       WHERE s.campaign_id = ?
         AND b.bag_id IS NULL`, [campaignId]);
            // ---- slot coverage (expected vs actual) ----
            const slotCoverageSql = `
WITH booklets_in_campaign AS (
  SELECT b.id AS booklet_id, b.session_id
  FROM booklets b
  JOIN sessions s ON s.id = b.session_id 
  WHERE s.campaign_id = ?
    AND b.bag_id IS NOT NULL
),

booklet_counts AS (
  SELECT session_id, COUNT(*) AS booklet_count
  FROM booklets_in_campaign
  GROUP BY session_id
),

question_counts AS (
  SELECT
    ss.session_id,
    ss.subject_id,

    COALESCE(
      NULLIF(COUNT(DISTINCT sq.question_no), 0),
      ss.question_count
    ) AS question_count_effective,

    COUNT(DISTINCT sq.question_no) AS question_count_sq,
    ss.question_count AS question_count_ss,

    (COUNT(DISTINCT sq.question_no) <> ss.question_count) AS mismatch_question_count
  FROM session_subjects ss
  JOIN sessions se ON se.id = ss.session_id
  LEFT JOIN subject_questions sq
    ON sq.subject_id = ss.subject_id
  WHERE se.campaign_id = ?
  GROUP BY ss.session_id, ss.subject_id, ss.question_count
),

expected AS (
  SELECT
    qc.session_id,
    qc.subject_id,
    COALESCE(bc.booklet_count, 0) AS booklet_count,
    qc.question_count_effective AS question_count,
    (COALESCE(bc.booklet_count, 0) * qc.question_count_effective * 2) AS expected_slots,

    qc.question_count_sq,
    qc.question_count_ss,
    qc.mismatch_question_count
  FROM question_counts qc
  LEFT JOIN booklet_counts bc ON bc.session_id = qc.session_id
),

actual AS (
  SELECT
    bic.session_id,
    gs.subject_id,
    COUNT(*) AS actual_slots,
    SUM(gs.grader_id IS NOT NULL) AS assigned_slots,
    SUM(gs.status = 'COMPLETED') AS completed_slots,
    SUM(gs.status = 'DISPUTED') AS disputed_slots,
    SUM(gs.status IN ('OPEN','ASSIGNED','DISPUTED')) AS pending_slots
  FROM grading_slots gs
  JOIN booklets_in_campaign bic ON bic.booklet_id = gs.booklet_id
  WHERE gs.grader_order IN (1,2)
  GROUP BY bic.session_id, gs.subject_id
)

SELECT
  e.session_id,
  e.subject_id,
  e.booklet_count,
  e.question_count,
  e.expected_slots,

  COALESCE(a.actual_slots,0)     AS actual_slots,
  COALESCE(a.assigned_slots,0)   AS assigned_slots,
  COALESCE(a.completed_slots,0)  AS completed_slots,
  COALESCE(a.disputed_slots,0)   AS disputed_slots,
  COALESCE(a.pending_slots,0)    AS pending_slots,

  GREATEST(e.expected_slots - COALESCE(a.actual_slots,0), 0) AS missing_slots,

  e.question_count_sq,
  e.question_count_ss,
  e.mismatch_question_count

FROM expected e
LEFT JOIN actual a
  ON a.session_id = e.session_id
 AND a.subject_id = e.subject_id
ORDER BY e.session_id, e.subject_id;
    `;
            // @ts-ignore
            const [slotCoverage] = yield conn.query(slotCoverageSql, [campaignId, campaignId]);
            // totals
            let missingSlotsTotal = 0;
            let notCompletedTotal = 0;
            let mismatchCountTotal = 0;
            for (const r of slotCoverage) {
                const miss = Math.max(0, Number(r.expected_slots) - Number(r.actual_slots));
                const notDone = Math.max(0, Number(r.expected_slots) - Number(r.completed_slots));
                missingSlotsTotal += miss;
                notCompletedTotal += notDone;
                if (Number(r.mismatch_question_count) === 1)
                    mismatchCountTotal += 1;
            }
            // build issues list
            const issues = [];
            const keyCount = Number(key_count);
            const ucCount = Number(uc_count);
            const missingSeat = Number(missing_seat);
            const pendingSlots = Number(pending_slots);
            const unbaggedCount = Number(unbagged);
            const missingScoreSlots = Number(missing_score_slots); // 👈 แปลงค่าตัวแปรใหม่
            if (keyCount === 0) {
                issues.push({ code: "NO_KEYS", message: "ยังไม่ได้สร้างคีย์สำหรับแคมเปญนี้" });
                // } else if (keyCount < 2) {
                //   issues.push({ code: "NOT_ENOUGH_KEYS", message: "คีย์ยังไม่ครบ 2 ดอก", meta: { keyCount } });
                // }
            }
            if (ucCount === 0) {
                issues.push({ code: "NO_IMPORT", message: "ยังไม่ได้ import ข้อมูลผู้เข้าสอบ (user_campaigns ว่าง)" });
            }
            if (missingSeat > 0) {
                issues.push({ code: "MISSING_SEAT", message: "ยังจัดที่นั่งสอบไม่ครบ", meta: { missingSeat } });
            }
            if (unbaggedCount > 0) {
                issues.push({ code: "UNBAGGED", message: "ยังมีเล่มที่ยังไม่ถูกจัดลงถุง (bag_id is NULL)", meta: { unbagged: unbaggedCount } });
            }
            if (mismatchCountTotal > 0) {
                issues.push({
                    code: "QUESTION_COUNT_MISMATCH",
                    message: "จำนวนข้อใน session_subjects ไม่ตรงกับ subject_questions",
                    meta: { mismatchCountTotal }
                });
            }
            if (missingSlotsTotal > 0) {
                issues.push({
                    code: "SLOT_MISSING",
                    message: "ระบบยังสร้าง grading slots ไม่ครบตามจำนวนที่ควรมี (อิงจากเล่มที่อยู่ในถุง)",
                    meta: { missingSlotsTotal }
                });
            }
            if (pendingSlots > 0) {
                issues.push({
                    code: "SLOT_NOT_COMPLETED",
                    message: "ยังมีช่องตรวจที่ยังไม่เสร็จ (OPEN/ASSIGNED/DISPUTED) สำหรับข้อสอบในถุง",
                    meta: { pendingSlots }
                });
            }
            else if (notCompletedTotal > 0) {
                issues.push({
                    code: "SLOT_NOT_COMPLETED",
                    message: "คะแนนยังไม่ครบทุกช่องตามจำนวนเล่มในถุงที่คำนวณไว้",
                    meta: { notCompletedTotal }
                });
            }
            // 🚀 NEW CASE: Push Error ถ้ามีข้อมูลคะแนนแหว่งหายไป
            if (missingScoreSlots > 0) {
                issues.push({
                    code: "COMPLETED_BUT_NO_SCORE",
                    message: `พบข้อมูลผิดปกติ: มีช่องตรวจจำนวน ${missingScoreSlots} ช่อง ที่สถานะเสร็จสิ้นแล้ว แต่ไม่พบข้อมูลคะแนนในระบบ (คะแนนอาจสูญหาย)`,
                    meta: { missingScoreSlots }
                });
            }
            const ok = issues.length === 0;
            return {
                ok,
                issues,
                counts: {
                    ucCount,
                    missingSeat,
                    pendingSlots,
                    unbagged: unbaggedCount,
                    missingSlotsTotal,
                    notCompletedTotal,
                    mismatchCountTotal,
                    missingScoreSlots, // 👈 ส่งค่ากลับไปให้เผื่อเอาไปทำ Log หรือ Debug ต่อได้
                },
                details: { slotCoverage },
            };
        });
    }
    getCampaignIdUnlock(campaignId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT id, is_unlock
      FROM exam_campaigns
      WHERE id = ?
      FOR UPDATE
    `;
            const [rows] = yield conn.query(sql, [campaignId]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
}
const decryptRepo = new DecryptRepo();
exports.default = decryptRepo;

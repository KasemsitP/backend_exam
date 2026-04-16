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
const DB_1 = require("../model/DB");
const gradingscoredraft_repo_1 = __importDefault(require("../Repo/gradingscoredraft.repo"));
const gradingscore_repo_1 = __importDefault(require("../Repo/gradingscore.repo"));
const gradingslot_repo_1 = __importDefault(require("../Repo/gradingslot.repo"));
const key_service_1 = require("./key.service");
const gradingrecheck_service_1 = require("./gradingrecheck.service");
class GradingScoreDraftService {
    static saveDraftScore(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                const isValid = yield gradingscoredraft_repo_1.default.verifySlotContext(conn, {
                    slotId: params.slotId,
                    campaignId: params.campaignId,
                    graderId: params.graderId,
                });
                if (!isValid) {
                    throw new Error("slot นี้ไม่อยู่ในสิทธิ์ของผู้ตรวจ หรือไม่อยู่ใน campaign นี้");
                }
                //  ต้องเช็ค lock ก่อน save
                const activeLock = yield gradingslot_repo_1.default.findActiveLockByGraderId(conn, params.graderId);
                if (!activeLock) {
                    throw new Error("ยังไม่ได้เริ่มตรวจ กรุณาสแกนและยืนยันเริ่มตรวจก่อน");
                }
                if (Number(activeLock.question_no) !== Number(params.questionNo)) {
                    throw new Error(`คุณกำลังตรวจข้อ ${activeLock.question_no} อยู่ กรุณาตรวจข้อนี้ให้เสร็จก่อน`);
                }
                const qInfo = yield gradingscoredraft_repo_1.default.checkScoreInfo(conn, {
                    slotId: params.slotId,
                    graderId: params.graderId,
                    questionNo: params.questionNo,
                });
                if (!qInfo) {
                    throw new Error("ไม่พบข้อมูลข้อสอบ");
                }
                if (params.score < 0 || params.score > Number(qInfo.max_score)) {
                    throw new Error(`คะแนนต้องอยู่ระหว่าง 0 - ${qInfo.max_score}`);
                }
                const ctx = yield gradingscoredraft_repo_1.default.findDraftContextBySlotId(conn, params.slotId);
                if (!ctx || !ctx.bagId) {
                    throw new Error("ไม่พบ bag ของ slot นี้");
                }
                yield gradingscoredraft_repo_1.default.upsertDraft(conn, {
                    bagId: Number(ctx.bagId),
                    bookletId: ctx.bookletId,
                    subjectId: ctx.subjectId,
                    questionNo: ctx.questionNo,
                    slotId: ctx.slotId,
                    graderId: ctx.graderId,
                    score: params.score,
                });
                // ❌ ห้าม release lock ตรงนี้
                yield conn.commit();
                return {
                    slotId: ctx.slotId,
                    bagId: ctx.bagId,
                    bookletId: ctx.bookletId,
                    subjectId: ctx.subjectId,
                    questionNo: ctx.questionNo,
                    score: params.score,
                    status: "DRAFT",
                };
            }
            catch (error) {
                yield conn.rollback();
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
    static getDraftsByBagId(bagId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                const drafts = yield gradingscoredraft_repo_1.default.findDraftsByBagId(conn, bagId);
                return drafts;
            }
            finally {
                conn.release();
            }
        });
    }
    static getDraftsUnconfirmed(graderId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                const drafts = yield gradingscoredraft_repo_1.default.getActiveDraftsByLock(conn, graderId);
                if (!drafts.length) {
                    return {
                        bag_id: null,
                        subject_name: null,
                        question_label: null,
                        question_no: null,
                        drafts: []
                    };
                }
                const first = drafts[0];
                console.log("first", first);
                //  เช็ค consistency ทั้งชุด (สำคัญมาก)
                const validRows = drafts.filter(d => d.subject_id !== null && d.question_no !== null);
                const isSameContext = validRows.every(d => d.bag_id === validRows[0].bag_id &&
                    d.subject_id === validRows[0].subject_id &&
                    d.question_no === validRows[0].question_no &&
                    d.bag_no === validRows[0].bag_no);
                if (!isSameContext) {
                    throw new Error("พบ draft ต่าง context (bag / subject / question) ซึ่งไม่ควรเกิดขึ้น");
                }
                //  mask payload
                const maskPayload = drafts.map(draft => (Object.assign(Object.assign({}, draft), { payload: draft.payload
                        ? key_service_1.keyService.maskQrPayload(draft.payload)
                        : null })));
                // หา random_num min / max
                const randomNums = drafts
                    .map(d => Number(d.random_num))
                    .filter(n => Number.isFinite(n));
                const min_random = randomNums.length > 0 ? Math.min(...randomNums) : null;
                const max_random = randomNums.length > 0 ? Math.max(...randomNums) : null;
                return {
                    bag_id: first.bag_id,
                    bag_no: first.bag_no,
                    min_random,
                    max_random,
                    subject_name: validRows[0].subject_name,
                    question_label: validRows[0].question_label,
                    question_no: validRows[0].question_no,
                    drafts: maskPayload
                };
            }
            finally {
                conn.release();
            }
        });
    }
    static confirmBagScores(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                if (!params.scores.length) {
                    throw new Error("ไม่พบคะแนนที่ต้องยืนยัน");
                }
                // 1) ตรวจว่า slot ทั้งหมดอยู่ใน bag นี้ และเป็นของ grader นี้
                const validSlots = yield gradingscoredraft_repo_1.default.validateSlotsForConfirm(conn, params.bagId, params.graderId, params.scores.map((s) => s.slot_id));
                if (!validSlots) {
                    throw new Error("พบ slot ที่ไม่ตรงกับถุงหรือไม่ใช่ของผู้ตรวจคนนี้");
                }
                // 2) update draft ตามคะแนนล่าสุดจาก frontend
                for (const item of params.scores) {
                    yield gradingscoredraft_repo_1.default.updateDraftScoreBySlotId(conn, item.slot_id, item.score);
                }
                // 3) เช็คว่ามีคะแนนจริงอยู่แล้วไหม
                for (const item of params.scores) {
                    const exists = yield gradingscore_repo_1.default.existsScoreBySlotId(conn, item.slot_id);
                    if (exists) {
                        throw new Error(`slot ${item.slot_id} มีคะแนนจริงแล้ว`);
                    }
                }
                console.log("params for confirmBagScores", params);
                const rows = yield gradingscoredraft_repo_1.default.getActiveDraftsByLock(conn, params.graderId);
                console.log("rows for confirmBagScores", rows);
                const missingSlotCount = rows.filter((r) => r.progress_status === "ยังไม่มี slot").length;
                const missingDraftCount = rows.filter((r) => r.progress_status === "มี slot แต่ยังไม่ตรวจ").length;
                console.log(`missingSlotCount: ${missingSlotCount}, missingDraftCount: ${missingDraftCount}`);
                if (missingSlotCount > 0 || missingDraftCount > 0) {
                    throw new Error(`ยังยืนยันไม่ได้ เหลือ ${missingSlotCount + missingDraftCount} ข้อ ` +
                        `(ยังไม่มี slot ${missingSlotCount}, มี slot แต่ยังไม่ตรวจ ${missingDraftCount})`);
                }
                yield gradingscore_repo_1.default.insertScoresFromDraftsByBagIdAndGraderId(conn, params.bagId, params.graderId);
                // 5) ตั้งต้น slot ของ grader นี้เป็น COMPLETED ก่อน
                yield gradingslot_repo_1.default.markSlotsCompletedByBagIdAndGraderId(conn, params.bagId, params.graderId);
                for (const item of params.scores) {
                    yield gradingrecheck_service_1.gradingRecheckService.checkAndMarkDisputedIfNeeded(conn, item.slot_id, 4);
                }
                // 7) mark draft confirmed
                yield gradingscoredraft_repo_1.default.markDraftsConfirmedByBagIdAndGraderId(conn, params.bagId, params.graderId);
                // 8) release lock
                yield gradingslot_repo_1.default.releaseActiveLockByGraderId(conn, params.graderId);
                yield conn.commit();
                return {
                    bagId: params.bagId,
                    graderId: params.graderId,
                    totalConfirmed: params.scores.length,
                    status: "CONFIRMED",
                };
            }
            catch (error) {
                console.log("Error in confirmBagScores:", error);
                yield conn.rollback();
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
    static cancelDraftScore(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                yield conn.beginTransaction();
                const draft = yield gradingscoredraft_repo_1.default.findDraftBySlotId(conn, params.slotId);
                if (!draft) {
                    throw new Error("ไม่พบ draft score ของ slot นี้");
                }
                if (draft.status !== "DRAFT") {
                    throw new Error("draft นี้ไม่อยู่ในสถานะที่ยกเลิกได้");
                }
                yield gradingscoredraft_repo_1.default.cancelDraftBySlotId(conn, params.slotId);
                //  ปล่อย lock ตอน cancel
                yield gradingslot_repo_1.default.releaseActiveLockByGraderId(conn, draft.grader_id);
                yield conn.commit();
                return {
                    slotId: params.slotId,
                    status: "CANCELLED",
                };
            }
            catch (error) {
                yield conn.rollback();
                throw error;
            }
            finally {
                conn.release();
            }
        });
    }
}
exports.default = GradingScoreDraftService;

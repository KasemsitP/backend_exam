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
exports.graderAssignmentService = void 0;
// src/Service/grader-assignment.service.ts
const grader_repo_1 = __importDefault(require("../Repo/grader.repo"));
const DB_1 = require("../model/DB");
const subject_assignment_repo_1 = __importDefault(require("../Repo/subject-assignment.repo"));
const grader_assignment_1 = __importDefault(require("../Repo/grader-assignment"));
class graderAssignmentService {
    static createBulk(assignments) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!assignments || assignments.length === 0)
                return;
            const conn = yield DB_1.DB.getInstance().getConnection();
            try {
                console.log(assignments);
                yield conn.beginTransaction();
                const graderCache = new Map();
                for (const a of assignments) {
                    const key = `${a.campaignId}-${a.accountId}`;
                    let grader;
                    let graderId;
                    if (graderCache.has(key)) {
                        graderId = graderCache.get(key);
                    }
                    else {
                        grader = yield grader_repo_1.default.findByCampaignAndAccount(a.campaignId, a.accountId, conn);
                        console.log(grader);
                        if (!grader) {
                            grader = yield grader_repo_1.default.create({
                                campaign_id: a.campaignId,
                                account_id: a.accountId,
                            }, conn);
                        }
                        console.log(grader);
                        graderId = grader.id;
                        graderCache.set(key, graderId);
                    }
                    const sq = yield subject_assignment_repo_1.default.findBySubjectAndNo(a.subjectId, a.questionNo, conn);
                    console.log(sq);
                    if (!sq) {
                        throw new Error(`subject_questions not found for subject_id=${a.subjectId}, question_no=${a.questionNo}`);
                    }
                    yield grader_assignment_1.default.insertOne({
                        grader_id: graderId,
                        session_id: a.sessionId,
                        subject_id: a.subjectId,
                        subject_question_id: sq.id,
                    }, conn);
                }
                yield conn.commit();
            }
            catch (err) {
                yield conn.rollback();
                console.error("Service Error (graderAssignmentService.createBulk):", err);
                throw err;
            }
            finally {
                conn.release();
            }
        });
    }
}
exports.graderAssignmentService = graderAssignmentService;

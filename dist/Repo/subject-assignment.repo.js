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
// src/Repo/subject-question.repo.ts
const DB_1 = require("../model/DB");
class SubjectQuestionRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    findBySubjectAndNo(subjectId_1, questionNo_1) {
        return __awaiter(this, arguments, void 0, function* (subjectId, questionNo, dbClient = this.pool) {
            var _a;
            const sql = `
      SELECT id, subject_id, question_no, label
      FROM subject_questions
      WHERE subject_id = ? AND question_no = ?
      LIMIT 1
    `;
            const [rows] = yield dbClient.execute(sql, [
                subjectId,
                questionNo,
            ]);
            return (_a = rows[0]) !== null && _a !== void 0 ? _a : null;
        });
    }
}
const subjectQuestionRepo = new SubjectQuestionRepo();
exports.default = subjectQuestionRepo;

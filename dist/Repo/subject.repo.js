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
exports.subjectRepo = void 0;
const DB_1 = require("../model/DB");
class SubjectRepo {
    constructor() {
        this.pool = DB_1.DB.getInstance();
    }
    /* ------------------- ใช้ดึงทุกวิชาพร้อมข้อ ------------------- */
    getSubjectsWithQuestions() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT
        s.id          AS subject_id,
        s.code        AS subject_code,
        s.name        AS subject_name,
        q.id          AS question_id,
        q.question_no AS question_no,
        q.label       AS question_label,
        q.max_score,
        s.full_score
      FROM subjects s
      LEFT JOIN subject_questions q
        ON q.subject_id = s.id
      ORDER BY s.id, q.question_no;
    `;
            const [rows] = yield this.pool.query(sql);
            const subjects = [];
            for (const r of rows) {
                let subject = subjects.find((s) => s.id === r.subject_id);
                if (!subject) {
                    subject = {
                        id: r.subject_id,
                        code: r.subject_code,
                        name: r.subject_name,
                        questions: [],
                        full_score: r.full_score
                    };
                    subjects.push(subject);
                }
                if (r.question_id !== null && r.question_no !== null) {
                    subject.questions.push({
                        id: String(r.question_id),
                        questionNo: r.question_no,
                        label: (_a = r.question_label) !== null && _a !== void 0 ? _a : "",
                        maxScore: r.max_score
                    });
                }
            }
            return subjects;
        });
    }
    /* ---------- helper: ดึง 1 วิชาพร้อมข้อ ด้วย id (ใช้หลัง C/U) ---------- */
    getSubjectWithQuestionsById(conn, id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = `
      SELECT
        s.id          AS subject_id,
        s.code        AS subject_code,
        s.name        AS subject_name,
        q.id          AS question_id,
        q.question_no AS question_no,
        q.label       AS question_label
      FROM subjects s
      LEFT JOIN subject_questions q
        ON q.subject_id = s.id
      WHERE s.id = ?
      ORDER BY q.question_no;
    `;
            const [rows] = yield conn.query(sql, [id]);
            if (rows.length === 0)
                return null;
            const first = rows[0];
            const subject = {
                id: first.subject_id,
                code: first.subject_code,
                name: first.subject_name,
                questions: [],
            };
            for (const r of rows) {
                if (r.question_id !== null && r.question_no !== null) {
                    subject.questions.push({
                        id: String(r.question_id),
                        questionNo: r.question_no,
                        label: (_a = r.question_label) !== null && _a !== void 0 ? _a : "",
                    });
                }
            }
            return subject;
        });
    }
    /* --------------------- CREATE subject (+questions) --------------------- */
    createSubjectWithQuestions(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const conn = yield this.pool.getConnection();
            try {
                yield conn.beginTransaction();
                const insertSubjectSql = `
        INSERT INTO subjects (code, name)
        VALUES (?, ?)
      `;
                const [subjectResult] = yield conn.query(insertSubjectSql, [input.code, input.name]);
                const subjectId = subjectResult.insertId;
                const questions = (_a = input.questions) !== null && _a !== void 0 ? _a : [];
                if (questions.length > 0) {
                    const placeholders = questions.map(() => "(?, ?, ?)").join(", ");
                    const params = [];
                    for (const q of questions) {
                        params.push(subjectId);
                        params.push(q.questionNo);
                        params.push(q.label);
                    }
                    const insertQuestionsSql = `
          INSERT INTO subject_questions (subject_id, question_no, label)
          VALUES ${placeholders}
        `;
                    yield conn.query(insertQuestionsSql, params);
                }
                yield conn.commit();
                const subject = yield this.getSubjectWithQuestionsById(conn, subjectId);
                if (!subject) {
                    return {
                        id: subjectId,
                        code: input.code,
                        name: input.name,
                        questions: [],
                    };
                }
                return subject;
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
    /* --------------------- UPDATE subject (+questions) --------------------- */
    updateSubject(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield this.pool.getConnection();
            try {
                yield conn.beginTransaction();
                const updateSql = `
        UPDATE subjects
        SET code = ?, name = ?
        WHERE id = ?
      `;
                yield conn.query(updateSql, [
                    input.code,
                    input.name,
                    input.id,
                ]);
                if (Array.isArray(input.questions)) {
                    const deleteSql = `DELETE FROM subject_questions WHERE subject_id = ?`;
                    yield conn.query(deleteSql, [input.id]);
                    if (input.questions.length > 0) {
                        const placeholders = input.questions.map(() => "(?, ?, ?)").join(", ");
                        const params = [];
                        for (const q of input.questions) {
                            params.push(input.id);
                            params.push(q.questionNo);
                            params.push(q.label);
                        }
                        const insertQuestionsSql = `
            INSERT INTO subject_questions (subject_id, question_no, label)
            VALUES ${placeholders}
          `;
                        yield conn.query(insertQuestionsSql, params);
                    }
                }
                yield conn.commit();
                return yield this.getSubjectWithQuestionsById(conn, input.id);
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
    /* --------------------------- DELETE subject ---------------------------- */
    deleteSubject(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const conn = yield this.pool.getConnection();
            try {
                yield conn.beginTransaction();
                const deleteQuestionsSql = `DELETE FROM subject_questions WHERE subject_id = ?`;
                yield conn.query(deleteQuestionsSql, [id]);
                const deleteSubjectSql = `DELETE FROM subjects WHERE id = ?`;
                yield conn.query(deleteSubjectSql, [id]);
                yield conn.commit();
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
    addQuestion(subjectId_1, label_1, maxScore_1, targetNo_1) {
        return __awaiter(this, arguments, void 0, function* (subjectId, label, maxScore, targetNo, dbClient = this.pool) {
            // 1️⃣ หาเลขข้อสูงสุดปัจจุบัน
            const [rows] = yield dbClient.query(`
    SELECT COALESCE(MAX(question_no), 0) AS max_no
    FROM subject_questions
    WHERE subject_id = ?
    `, [subjectId]);
            const maxNo = Number(rows[0].max_no);
            let safeNo = typeof targetNo === "number" && !Number.isNaN(targetNo)
                ? targetNo
                : maxNo + 1;
            if (safeNo < 1)
                safeNo = 1;
            if (safeNo > maxNo + 1)
                safeNo = maxNo + 1;
            // 3️⃣ เลื่อน question_no ถ้าจะแทรกกลาง
            yield dbClient.query(`
    UPDATE subject_questions
    SET question_no = question_no + 1
    WHERE subject_id = ?
      AND question_no >= ?
    `, [subjectId, safeNo]);
            yield dbClient.query(`
    INSERT INTO subject_questions 
      (subject_id, question_no, label, max_score)
    VALUES (?, ?, ?, ?)
    `, [subjectId, safeNo, label, maxScore]);
            const subject = yield this.getSubjectWithQuestionsById(dbClient, subjectId);
            if (!subject) {
                throw new Error("ไม่เจอวิชาที่สามารถเพิ่มหัวข้อได้");
            }
            return subject;
        });
    }
    deleteQuestion(subjectId, questionId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            yield conn.query("DELETE FROM subject_questions WHERE id = ? AND subject_id = ?", [questionId, subjectId]);
            yield conn.query("SET @no := 0");
            yield conn.query(`
    UPDATE subject_questions
    SET question_no = (@no := @no + 1)
    WHERE subject_id = ?
    ORDER BY question_no ASC
    `, [subjectId]);
        });
    }
    decreaseFullScore(subjectId, removedScore, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            yield conn.query("UPDATE subjects SET full_score = full_score - ? WHERE id = ?", [removedScore, subjectId]);
        });
    }
    GetSubjectNameandQuestionNo(sessionId, campaign_id) {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = `SELECT
  sq.subject_id,
  sq.id          AS subject_question_id,
  sq.question_no,
  sq.label       AS question_name,
  sq.max_score
FROM session_subjects ss
JOIN sessions s
  ON s.id = ss.session_id
JOIN subject_questions sq
  ON sq.subject_id = ss.subject_id
WHERE ss.session_id = ?
  AND s.campaign_id = ?
ORDER BY sq.subject_id, sq.question_no ASC
LIMIT 0, 25;`;
            const [rows] = yield this.pool.query(sql, [sessionId, campaign_id]);
            return rows;
        });
    }
    getMaxScoreById(subject_id_1) {
        return __awaiter(this, arguments, void 0, function* (subject_id, dbClient = this.pool) {
            const sql = `SELECT sj.full_score from subjects sj where sj.id = ? for update`;
            const [rows] = yield dbClient.query(sql, [subject_id]);
            return rows[0];
        });
    }
    getQuestionByCamp(campaign_id_1) {
        return __awaiter(this, arguments, void 0, function* (campaign_id, dbClient = this.pool) {
            const sql = `select sess.id as session_id , s.name as subject_name , s.id as subject_id , sq.question_no , sq.label  FROM subject_questions sq 
JOIN subjects s ON s.id = sq.subject_id
JOIN session_subjects ss ON ss.subject_id = s.id
JOIN sessions sess ON sess.id = ss.session_id
WHERE sess.campaign_id = ?
ORDER BY s.name , sq.question_no;`;
            const [rows] = yield dbClient.query(sql, [campaign_id]);
            return rows;
        });
    }
    updateMaxScore(subject_id_1, newMaxScore_1) {
        return __awaiter(this, arguments, void 0, function* (subject_id, newMaxScore, dbClient = this.pool) {
            const sql = `UPDATE subjects SET full_score = full_score + ? WHERE id = ?`;
            yield dbClient.query(sql, [newMaxScore, subject_id]);
        });
    }
    getQuestionById(subjectId, questionId, conn) {
        return __awaiter(this, void 0, void 0, function* () {
            const [rows] = yield conn.query(`SELECT max_score AS maxScore 
     FROM  subject_questions
     WHERE id = ? AND subject_id = ?
     FOR UPDATE`, [questionId, subjectId]);
            return rows[0];
        });
    }
}
exports.subjectRepo = new SubjectRepo();
exports.default = exports.subjectRepo;

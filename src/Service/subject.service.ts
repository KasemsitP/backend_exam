import { Request } from "express";
import { DB } from "../model/DB";
import subjectRepo, { Subject } from "../Repo/subject.repo";

export class SubjectService {
    static getAllSubjects = async (_req: Request): Promise<Subject[]> => {
        return subjectRepo.getSubjectsWithQuestions();
    };
    static  getQuestionByCamp = async (campaignId: number) => {
        return subjectRepo.getQuestionByCamp(campaignId);
    };

    static createSubject = async (req: Request): Promise<Subject> => {
        const { code, name, questions } = req.body as {
            code: string;
            name: string;
            questions?: { questionNo: number; label: string }[];
        };

        if (!code || !name) {
            throw new Error("code and name are required");
        }

        return subjectRepo.createSubjectWithQuestions({
            code: code.trim(),
            name: name.trim(),
            questions: Array.isArray(questions) ? questions : [],
        });
    };

    static updateSubject = async (req: Request): Promise<Subject | null> => {
        const id = Number(req.params.id);
        const { code, name, questions } = req.body as {
            code: string;
            name: string;
            questions?: { questionNo: number; label: string }[];
        };

        if (!id || Number.isNaN(id)) {
            throw new Error("Invalid subject id");
        }

        return subjectRepo.updateSubject({
            id,
            code: code.trim(),
            name: name.trim(),
            questions: Array.isArray(questions) ? questions : undefined,
        });
    };

    static deleteSubject = async (req: Request): Promise<void> => {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            throw new Error("Invalid subject id");
        }
        await subjectRepo.deleteSubject(id);
    };
    static addQuestion = async (req: Request): Promise<Subject> => {
        const subjectId = Number(req.params.id);
        const { label, questionNo, maxScore } = req.body;

        if (!maxScore) {
            throw new Error("กรุณาใส่คะแนนเต็ม");
        }

        if (!label || !label.trim()) {
            throw new Error("ชื่อหัวข้อไม่สามารถเว้นว่างได้");
        }

        if (!subjectId || Number.isNaN(subjectId)) {
            throw new Error("รหัสวิชาไม่ถูกต้อง");
        }

        const conn = await DB.getInstance().getConnection();

        try {
            await conn.beginTransaction();

            const targetNo = questionNo ? Number(questionNo) : undefined;

            const fullScore = await subjectRepo.getMaxScoreById(subjectId, conn);
            const addedScore = Number(maxScore);

            if (!fullScore) {
                throw new Error("ไม่เจอคะแนนเต็มข้อวิชา");
            }
            const currentScore = fullScore.full_score;

            if (currentScore + addedScore > 100) {
                throw new Error("คะแนนรวมของหัวข้อทั้งหมดต้องไม่เกิน 100");
            }

            const result = await subjectRepo.addQuestion(
                subjectId,
                label.trim(),
                Number(maxScore),
                targetNo,
                conn
            );
            await subjectRepo.updateMaxScore(subjectId, addedScore, conn);


            await conn.commit();

            return result;
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    };

    static deleteQuestion = async (req: Request): Promise<void> => {
        const subjectId = Number(req.params.id);
        const questionId = Number(req.params.questionId);

        if (!subjectId || Number.isNaN(subjectId) ||
            !questionId || Number.isNaN(questionId)) {
            throw new Error("ไม่พบรหัสวิชาที่ต้องการลบ");
        }

        const conn = await DB.getInstance().getConnection();

        try {
            await conn.beginTransaction();

            // ดึงคะแนนของข้อที่จะลบ (lock แถว)
            const question = await subjectRepo.getQuestionById(
                subjectId,
                questionId,
                conn
            );

            if (!question) {
                throw new Error("ไม่พบหัวข้อที่ต้องการลบ");
            }

            const removedScore = question.maxScore;

            // ลบข้อสอบ
            await subjectRepo.deleteQuestion(subjectId, questionId, conn);

            // ลบคะแนนออกจาก subject แบบ atomic
            await subjectRepo.decreaseFullScore(subjectId, removedScore, conn)

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    };

    static getSubjectandQuestion = async (sessionId: number, campaign_id: number): Promise<any> => {
        const result = await subjectRepo.GetSubjectNameandQuestionNo(sessionId, campaign_id);
        return result;
    }
}

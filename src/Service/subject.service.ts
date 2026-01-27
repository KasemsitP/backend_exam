import { Request } from "express";
import subjectRepo, { Subject } from "../Repo/subject.repo";

export class SubjectService {
    static getAllSubjects = async (_req: Request): Promise<Subject[]> => {
        return subjectRepo.getSubjectsWithQuestions();
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
        const { label , questionNo  } = req.body;

        if (!label || !label.trim()) {
            throw new Error("Label is required");
        }
        if (!subjectId || Number.isNaN(subjectId)) {
            throw new Error("Invalid subject id");
        }
        const targetNo = questionNo ? Number(questionNo) : undefined;

        return subjectRepo.addQuestion(subjectId , label.trim(), targetNo);
    };

    static deleteQuestion = async (req: Request): Promise<Subject> => {
        const subjectId = Number(req.params.id);
        const questionId = Number(req.params.questionId);
        if (!subjectId || Number.isNaN(subjectId) || !questionId || Number.isNaN(questionId)) {
            throw new Error("Invalid id");
        }
        return subjectRepo.deleteQuestion(subjectId, questionId);
    };
    static getSubjectandQuestion = async (sessionId: number, campaign_id: number): Promise<any> => {
        const result = await subjectRepo.GetSubjectNameandQuestionNo(sessionId , campaign_id);
        return result;
    }
}

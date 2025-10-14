import { Request } from "express"
import subjectrepo from "../Repo/subject.repo";
import { Result } from "pg";

export class subjectservice {
    static getSubjectByCampaign = async (req: Request) => {
        const { campaignCode } = req.query;
        if (!campaignCode) throw new Error("campaignCode is required");

        const result = await subjectrepo.getSubject(String(campaignCode))
        if (result.length === 0) throw new Error("no information")
        return result;
    };

    static insertBySessionSubject = async (req: Request) => {
        const {
            campaignCode,
            sessionCode,
            subjectCode,
            subjectName,
            qCount,
            qRange,
            startAt,
            endAt,
        } = req.body;

        if (!campaignCode) throw new Error("campaignCode is required");
        if (!sessionCode) throw new Error("sessionCode is required");
     /*   const result = await subjectrepo.getSubject(String(campaignCode));
        if (result.length === 0) throw new Error("no information found in this campaign");*/
        const result2  = await subjectrepo.addSubjectToSession({
  session_code: sessionCode,
  subject_code: subjectCode,
  subject_name: subjectName,
  start_at: startAt,
  end_at: endAt,
  q_count: qCount,
  q_range: qRange,
});

        return result2;
        
    };



}
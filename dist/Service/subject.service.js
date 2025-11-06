"use strict";
// import { Request } from "express"
// import subjectrepo from "../Repo/subject.repo";
// import { Result } from "pg";
// export class subjectservice {
//     static getSubjectByCampaign = async (req: Request) => {
//         const { campaignCode } = req.query;
//         if (!campaignCode) throw new Error("กรุณาระบุ campaignCode");
//         const result = await subjectrepo.getSubject(String(campaignCode))
//         if (result.length === 0) throw new Error("ไม่พบข้อมูล")
//         return result;
//     };
//     static insertBySessionSubject = async (req: Request) => {
//         const {
//             campaignCode,
//             sessionCode,
//             subjectCode,
//             subjectName,
//             qCount,
//             qRange,
//             startAt,
//             endAt,
//         } = req.body;
//         if (!campaignCode) throw new Error("กรุณาระบุ campaignCode");
//         if (!sessionCode) throw new Error("กรุณาระบุ sessionCode");
//      /*   const result = await subjectrepo.getSubject(String(campaignCode));
//         if (result.length === 0) throw new Error("ไม่พบข้อมูลในแคมเปญนี้");*/
//         const result2  = await subjectrepo.addSubjectToSession({
//   session_code: sessionCode,
//   subject_code: subjectCode,
//   subject_name: subjectName,
//   start_at: startAt,
//   end_at: endAt,
//   q_count: qCount,
//   q_range: qRange,
// });
//         return result2;
//     };
// }

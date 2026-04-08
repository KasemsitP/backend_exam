import gradingScoreLogRepo from "../Repo/grading_score_log";



export class gradingScoreLogService {

    static getScoreLogByBagId = async (bagId : number) => {
        return await gradingScoreLogRepo.getScoreLogByBagId(bagId);
    }
}

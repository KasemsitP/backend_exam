import authrepo from "../Repo/auth.repo"
import { utills } from "../utills/utills"

export class authservice {
    static IsDuplicate = async (username: string) => {
        const row = await authrepo.checkUsername(username)
        if (row.length) {
            throw new Error("มีชื่อผู้ใช้งานซ้ำ")
        }
    }
    // เพิ่ม parameter campaignId (optional สำหรับกรณีแอดมินล็อกอินปกติ)
   static CheckUsername = async (username: string, password: string) => {
        // จังหวะที่ 1: ลองค้นหาด้วย username ตรงๆ ก่อน (สำหรับ Admin หรือ Staff)
        let row = await authrepo.findByUsername(username);
        let currentCampaignId = null;

        // จังหวะที่ 2: ถ้าไม่เจอ ลองเช็คว่าเป็น Grader หรือไม่ โดยหาแคมเปญที่ Active อยู่
        if (!row) {
            const activeCampaigns = await authrepo.getActiveCampaigns();

            if (activeCampaigns.length === 1) {
                // ถ้ามีเปิดใช้งานแค่ 1 แคมเปญ เอา ID มาต่อหน้าชื่อ
                currentCampaignId = activeCampaigns[0].id;
                const searchUsername = `${currentCampaignId}_${username}`;
                
                // ค้นหาอีกรอบด้วยชื่อที่มี _ นำหน้า (เช่น 1_grader)
                row = await authrepo.findByUsername(searchUsername);
                
            } else if (activeCampaigns.length > 1) {
                // ดัก Error ไว้ เผื่ออนาคตมีการเปิด 2 แคมเปญพร้อมกัน ระบบจะได้ไม่พัง
                throw new Error("ระบบมีรอบการสอบที่เปิดใช้งานมากกว่า 1 รอบ ไม่สามารถระบุผู้ใช้งานได้");
            }
        }

        // ถ้ายังไม่เจออีก แปลว่าพิมพ์ชื่อผิดจริงๆ
        if (!row) throw new Error("ไม่พบผู้ใช้ หรือชื่อผู้ใช้งานไม่ถูกต้อง");

        if (Number(row.active) !== 1) throw new Error("บัญชีถูกระงับการใช้งาน");

        const match = await utills.bcryptCompare(password, row.password_hash);
        if (!match) throw new Error("รหัสผ่านไม่ถูกต้อง");

        const roleCode = (row.role_code || "staff").toLowerCase();

        return {
            id: row.id,
            name: row.full_name,
            username: row.username, // จะคืนค่าเป็น '1_grader' หรือ 'admin' ตามใน DB
            roles: [roleCode],
            active: Number(row.active),
            sessionVersion: Number(row.session_version ?? 1),
            campaignId: currentCampaignId || row.campaign_id // คืนค่าแคมเปญกลับไปด้วย
        };
    }

    static CheckPasswordByID = async (account_id: number, password: string) => {
        const row = await authrepo.findMeByIdAndPassword(account_id);

        if (!row) throw new Error("ไม่พบผู้ใช้");
        if (Number(row.active) !== 1) throw new Error("บัญชีถูกระงับการใช้งาน");
        const match = await utills.bcryptCompare(password, row.password_hash);
        if (!match) throw new Error("รหัสผ่านไม่ถูกต้อง");
        const roleCode = (row.role_code).toLowerCase();
        return {
            id: row.id,
            name: row.full_name,
            username: row.username,
            roles: [roleCode],
            active: Number(row.active),
        };
    }

    static getAllAccounts = async () => {
        const rows = await authrepo.findAllAccountsWithRoles();
        // (แปลง active (0/1) เป็น boolean)
        return rows.map(row => ({
            ...row,
            active: !!row.active
        }));
    }
    static getAllGradersAccounts = async (campaign: number) => {
        const rows = await authrepo.findAllAccountsGraderByCampaign(Number(campaign));
        return rows.map(row => ({
            ...row,
            username: row.username.split("_").slice(1).join("_") || row.username, // ถ้าเป็น grader ให้ตัด campaignId ออก
            active: !!row.active
        }));
    }

    static getAllRoles = async () => {
        return await authrepo.findAllRoles();
    }

    static updateAccount = async (id: number, data: any) => {
        const updateData: any = {
            full_name: data.full_name,
            email: data.email,
            role_id: data.role_id,
            active: data.active
        };

        // (ถ้ารหัสใหม่ถูกส่งมา ให้ Hash มันด้วย)
        if (data.newPassword) {
            updateData.password_hash = await utills.hash(data.newPassword);
        }

        await authrepo.updateAccount(id, updateData);

        // (ดึงข้อมูลที่อัปเดตแล้วกลับไป)
        const updatedRows = await authrepo.findAllAccountsWithRoles();
        const updatedAccount = updatedRows.find(acc => acc.id === id);
        if (!updatedAccount) {
            throw new Error("ไม่พบผู้ใช้หลังจากอัปเดต"); // หรือจัดการ error ตามต้องการ
        }

        return { ...updatedAccount, active: !!updatedAccount.active };
    }
    static revokeAccount = async (targetAccountId: number, actorAccountId?: number) => {
        // กัน revoke ตัวเอง (optional แต่แนะนำ)
        if (actorAccountId && targetAccountId === actorAccountId) {
            throw new Error("ไม่สามารถระงับบัญชีตัวเองได้");
        }

        const target = await authrepo.findAccountBasicById(targetAccountId);
        if (!target) throw new Error("ไม่พบผู้ใช้");
        // console.log(target)

        if (Number(target.active) !== 1) {
            // ถูก revoke อยู่แล้ว
            return { id: target.id, active: false, alreadyRevoked: true };
        }

        await authrepo.revokeAccountById(targetAccountId);

        return { id: targetAccountId, active: false };
    };

    static unrevokeAccount = async (targetAccountId: number) => {
        const target = await authrepo.findAccountBasicById(targetAccountId);
        if (!target) throw new Error("ไม่พบผู้ใช้");

        await authrepo.unrevokeAccountById(targetAccountId);

        return { id: targetAccountId, active: true };
    };

    static deleteAccount = async (id: number) => {
        const checkRole = await authrepo.checkRoleByID(id);
        console.log(checkRole)
        console.log(id)
        console.log("comes")
        if (checkRole.code === "GRADER") {
            console.log(id)
            await authrepo.deleteAccountWithRelations(id);
        } else {
            await authrepo.deleteAccount(id);
        }

        //    await authrepo.deleteAccount(id);
        return { id };
    }

}

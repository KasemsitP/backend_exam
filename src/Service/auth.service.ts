import authrepo from "../Repo/auth.repo"
import { utills } from "../utills/utills"

export class authservice {
    static IsDuplicate = async (username: string) => {
        const row = await authrepo.checkUsername(username)
        if (row.length) {
            throw new Error("มีชื่อผู้ใช้งานซ้ำ")
        }
    }
    static CheckUsername = async (username: string, password: string) => {
        const row = await authrepo.findByUsername(username);

        if (!row) throw new Error("ไม่พบผู้ใช้");

        const match = await utills.bcryptCompare(password, row.password_hash);
        if (!match) throw new Error("รหัสผ่านไม่ถูกต้อง");

        const { password_hash, ...secureUserData } = row;

        const roleCode = (row.role_code || "staff").toLowerCase(); // "admin"

        return {
            id: secureUserData.id.toString(),
            name: secureUserData.full_name,
            username: secureUserData.username,
            roles: [roleCode]
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

    static deleteAccount = async (id: number) => {
        // (TODO: ควรเช็คว่า Account นี้ถูกใช้งานใน Graders หรือไม่ก่อนลบ)
        await authrepo.deleteAccount(id);
        return { id };
    }

}

import authrepo from "../Repo/auth.repo"
import { utills } from "../utills/utills"

export class authservice{
    static IsDuplicate = async(username: string)=>{
        const row =  await authrepo.checkUsername(username)
        if(row.length ){        
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
}

import authrepo from "../Repo/auth.repo"
import { utills } from "../utills/utills"

export class authservice{
    static IsDuplicate = async(username: string)=>{
        const row =  await authrepo.checkUsername(username)
        if(row.length ){        
            throw new Error("dubplicated username ")
        }    
    }
    static CheckUsername = async(username : string , password : string )=>{
        const row =  await authrepo.findByUsername(username)
        if(!row) throw new Error("no users")
        const match = await utills.bcryptCompare(password,row.password_hash)
        if(!match) throw new Error("wrong password")
        return row
    }
}
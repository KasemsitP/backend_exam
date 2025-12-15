import {Request , Response , NextFunction} from "express"



export const Logging =(req : Request , res : Response , next : NextFunction)  =>{
    const start = Date.now()
    const {method  , originalUrl} = req
    const {statusCode} = res
    const {ip} = req
    
    res.on('finish',()=>{
         const timestamp = new Date(start).toLocaleString();
        const durationMs = Date.now()- start
        console.log(`${method} ${originalUrl} status:${statusCode} duration:${durationMs}ms  ip${ip} timestamp:[${timestamp}] `)
    })
    next()
}
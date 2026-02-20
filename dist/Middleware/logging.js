"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logging = void 0;
const Logging = (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl } = req;
    const { statusCode } = res;
    const { ip } = req;
    res.on('finish', () => {
        const timestamp = new Date(start).toLocaleString();
        const durationMs = Date.now() - start;
        console.log(`${method} ${originalUrl} status:${statusCode} duration:${durationMs}ms  ip${ip} timestamp:[${timestamp}] `);
    });
    next();
};
exports.Logging = Logging;

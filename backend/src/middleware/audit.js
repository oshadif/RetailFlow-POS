import { pool } from "../db.js";

export function audit(action, entityType, entityIdResolver = () => null) {
  return async function auditMiddleware(req, res, next) {
    const originalJson = res.json.bind(res);
    let responseBody = null;

    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on("finish", async () => {
      if (res.statusCode >= 400) return;
      try {
        await pool.query(
          `INSERT INTO audit_logs
           (branch_id,user_id,action,entity_type,entity_id,method,path,ip_address,user_agent,after_data)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            req.user?.branchId || null,
            req.user?.id || null,
            action,
            entityType,
            entityIdResolver(req, responseBody),
            req.method,
            req.originalUrl,
            req.ip,
            req.get("user-agent") || "",
            responseBody ? JSON.stringify(responseBody) : null
          ]
        );
      } catch (error) {
        console.error("Audit log error", error);
      }
    });

    next();
  };
}

import {Router} from "express";
import {pool} from "../db.js";
import {requireAuth,requireAdmin} from "../middleware/auth.js";
const router=Router();
router.get("/",requireAuth,requireAdmin,async(req,res)=>{
 const {limit=200}=req.query;
 const r=await pool.query(`SELECT a.*,u.name user_name,b.name branch_name FROM audit_logs a
 LEFT JOIN users u ON u.id=a.user_id LEFT JOIN branches b ON b.id=a.branch_id
 ORDER BY a.created_at DESC LIMIT $1`,[Math.min(Number(limit),1000)]);
 res.json(r.rows);
});
export default router;

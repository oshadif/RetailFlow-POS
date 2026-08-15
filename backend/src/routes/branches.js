import {Router} from "express";
import {pool} from "../db.js";
import {requireAuth,requireAdmin} from "../middleware/auth.js";
import {audit} from "../middleware/audit.js";
const router=Router();

router.get("/",requireAuth,async(req,res)=>{
 const r=await pool.query("SELECT * FROM branches WHERE active=true ORDER BY name");res.json(r.rows);
});
router.post("/",requireAuth,requireAdmin,audit("branch_create","branch",(req,body)=>body?.id),async(req,res)=>{
 const b=req.body;const r=await pool.query("INSERT INTO branches(code,name,address,phone) VALUES($1,$2,$3,$4) RETURNING *",[b.code,b.name,b.address||"",b.phone||""]);res.status(201).json(r.rows[0]);
});
router.get("/inventory",requireAuth,async(req,res)=>{
 const r=await pool.query(`SELECT p.id,p.name,p.sku,p.barcode,p.selling_price_lkr,p.cost_price_lkr,p.reorder_level,p.unit,
 COALESCE(i.stock_quantity,0) stock_quantity,c.name category_name
 FROM products p LEFT JOIN branch_inventory i ON i.product_id=p.id AND i.branch_id=$1
 LEFT JOIN categories c ON c.id=p.category_id WHERE p.active=true ORDER BY p.name`,[req.user.branchId]);
 res.json(r.rows);
});
export default router;

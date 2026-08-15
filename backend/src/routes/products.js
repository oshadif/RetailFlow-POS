import {Router} from "express";
import {pool} from "../db.js";
import {requireAuth,requireAdmin} from "../middleware/auth.js";
import {audit} from "../middleware/audit.js";
const router=Router();

router.get("/",requireAuth,async(req,res)=>{
 const {search="",category=""}=req.query;
 const r=await pool.query(`SELECT p.*,COALESCE(i.stock_quantity,0) stock_quantity,c.name category_name,s.name supplier_name
 FROM products p LEFT JOIN branch_inventory i ON i.product_id=p.id AND i.branch_id=$1
 LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN suppliers s ON s.id=p.supplier_id
 WHERE p.active=true AND ($2='' OR p.name ILIKE '%'||$2||'%' OR p.sku ILIKE '%'||$2||'%' OR p.barcode ILIKE '%'||$2||'%')
 AND ($3='' OR c.name=$3) ORDER BY p.name`,[req.user.branchId,search,category]);
 res.json(r.rows);
});

router.post("/",requireAuth,requireAdmin,audit("product_create","product",(req,body)=>body?.id),async(req,res)=>{
 const b=req.body;const c=await pool.connect();
 try{
  await c.query("BEGIN");
  const r=await c.query(`INSERT INTO products(category_id,supplier_id,name,sku,barcode,description,cost_price_lkr,selling_price_lkr,reorder_level,unit)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
  [b.categoryId||null,b.supplierId||null,b.name,b.sku,b.barcode||null,b.description||"",b.costPriceLkr,b.sellingPriceLkr,b.reorderLevel||5,b.unit||"item"]);
  await c.query("INSERT INTO branch_inventory(branch_id,product_id,stock_quantity) VALUES($1,$2,$3)",[req.user.branchId,r.rows[0].id,b.stockQuantity||0]);
  await c.query("COMMIT");res.status(201).json({...r.rows[0],stock_quantity:b.stockQuantity||0});
 }catch(e){await c.query("ROLLBACK");console.error(e);res.status(500).json({message:"Unable to create product."});}
 finally{c.release();}
});

router.post("/:id/adjust",requireAuth,requireAdmin,audit("stock_adjustment","product",(req)=>req.params.id),async(req,res)=>{
 const qty=Number(req.body.quantity);const c=await pool.connect();
 try{
  await c.query("BEGIN");
  const r=await c.query(`INSERT INTO branch_inventory(branch_id,product_id,stock_quantity) VALUES($1,$2,$3)
  ON CONFLICT(branch_id,product_id) DO UPDATE SET stock_quantity=branch_inventory.stock_quantity+$3 RETURNING *`,
  [req.user.branchId,req.params.id,qty]);
  await c.query(`INSERT INTO stock_movements(branch_id,product_id,movement_type,quantity,note,created_by)
  VALUES($1,$2,$3,$4,$5,$6)`,[req.user.branchId,req.params.id,qty>=0?"adjustment_in":"adjustment_out",Math.abs(qty),req.body.note||"",req.user.id]);
  await c.query("COMMIT");res.json(r.rows[0]);
 }catch(e){await c.query("ROLLBACK");console.error(e);res.status(500).json({message:"Stock adjustment failed."});}
 finally{c.release();}
});
export default router;

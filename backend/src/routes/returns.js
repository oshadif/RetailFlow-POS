import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";
const router=Router();
const ref=()=>`RET-${Date.now().toString().slice(-10)}`;

router.post("/",requireAuth,audit("return_create","return",(req,body)=>body?.id||null),async(req,res)=>{
 const {saleId,items,reason,refundMethod}=req.body;
 const c=await pool.connect();
 try{
  await c.query("BEGIN");
  const sale=await c.query("SELECT * FROM sales WHERE id=$1 AND branch_id=$2 FOR UPDATE",[saleId,req.user.branchId]);
  if(!sale.rowCount) throw Object.assign(new Error("Sale not found."),{status:404});
  let total=0; const prepared=[];
  for(const x of items){
    const r=await c.query("SELECT * FROM sale_items WHERE id=$1 AND sale_id=$2 FOR UPDATE",[x.saleItemId,saleId]);
    if(!r.rowCount) throw Object.assign(new Error("Sale item not found."),{status:404});
    const si=r.rows[0],qty=Number(x.quantity);
    const remaining=Number(si.quantity)-Number(si.returned_quantity);
    if(qty<=0||qty>remaining) throw Object.assign(new Error(`Invalid return quantity for ${si.product_name}.`),{status:400});
    const refund=Number(si.unit_price_lkr)*qty; total+=refund; prepared.push({si,qty,refund,restock:x.restock!==false});
  }
  const rr=await c.query(`INSERT INTO returns(branch_id,return_number,sale_id,processed_by,reason,refund_method,refund_amount_lkr)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[req.user.branchId,ref(),saleId,req.user.id,reason,refundMethod,total]);
  for(const x of prepared){
    await c.query(`INSERT INTO return_items(return_id,sale_item_id,product_id,quantity,refund_amount_lkr,restock)
      VALUES($1,$2,$3,$4,$5,$6)`,[rr.rows[0].id,x.si.id,x.si.product_id,x.qty,x.refund,x.restock]);
    await c.query("UPDATE sale_items SET returned_quantity=returned_quantity+$1 WHERE id=$2",[x.qty,x.si.id]);
    if(x.restock){
      await c.query(`INSERT INTO branch_inventory(branch_id,product_id,stock_quantity) VALUES($1,$2,$3)
      ON CONFLICT(branch_id,product_id) DO UPDATE SET stock_quantity=branch_inventory.stock_quantity+$3`,
      [req.user.branchId,x.si.product_id,x.qty]);
      await c.query(`INSERT INTO stock_movements(branch_id,product_id,movement_type,quantity,reference_type,reference_id,note,created_by)
      VALUES($1,$2,'return_in',$3,'return',$4,$5,$6)`,[req.user.branchId,x.si.product_id,x.qty,rr.rows[0].id,reason,req.user.id]);
    }
  }
  const allReturned=await c.query(`SELECT BOOL_AND(returned_quantity>=quantity) complete FROM sale_items WHERE sale_id=$1`,[saleId]);
  if(allReturned.rows[0].complete) await c.query("UPDATE sales SET status='refunded' WHERE id=$1",[saleId]);
  else await c.query("UPDATE sales SET status='partially_refunded' WHERE id=$1",[saleId]);
  await c.query("COMMIT"); res.status(201).json(rr.rows[0]);
 }catch(e){await c.query("ROLLBACK");console.error(e);res.status(e.status||500).json({message:e.message||"Return failed."});}
 finally{c.release();}
});

router.get("/",requireAuth,async(req,res)=>{
 const r=await pool.query(`SELECT r.*,s.invoice_number,u.name processed_by_name FROM returns r
 JOIN sales s ON s.id=r.sale_id JOIN users u ON u.id=r.processed_by
 WHERE r.branch_id=$1 ORDER BY r.created_at DESC`,[req.user.branchId]);res.json(r.rows);
});
export default router;

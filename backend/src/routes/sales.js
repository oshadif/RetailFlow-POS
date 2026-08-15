import {Router} from "express";
import PDFDocument from "pdfkit";
import {pool} from "../db.js";
import {requireAuth} from "../middleware/auth.js";
const router=Router();
const invoice=()=>`INV-${Date.now().toString().slice(-10)}`;

router.post("/",requireAuth,async(req,res)=>{
 const {items,customerId,discountLkr=0,taxRate=0,paymentMethod,amountReceivedLkr,offlineReference}=req.body;
 if(!Array.isArray(items)||!items.length) return res.status(400).json({message:"Cart is empty."});
 const c=await pool.connect();
 try{
  await c.query("BEGIN");
  if(offlineReference){
    const existing=await c.query("SELECT * FROM sales WHERE offline_reference=$1",[offlineReference]);
    if(existing.rowCount){await c.query("ROLLBACK");return res.json(existing.rows[0]);}
  }
  let subtotal=0; const prepared=[];
  for(const item of items){
    const r=await c.query(`SELECT p.*,COALESCE(i.stock_quantity,0) stock_quantity FROM products p
    LEFT JOIN branch_inventory i ON i.product_id=p.id AND i.branch_id=$2
    WHERE p.id=$1 AND p.active=true FOR UPDATE OF p`,[item.productId,req.user.branchId]);
    if(!r.rowCount) throw Object.assign(new Error("Product not found."),{status:404});
    const p=r.rows[0],q=Number(item.quantity);
    if(q<=0||Number(p.stock_quantity)<q) throw Object.assign(new Error(`Insufficient stock for ${p.name}.`),{status:409});
    const line=Number(p.selling_price_lkr)*q; subtotal+=line;
    prepared.push({p,q,line});
  }
  const tax=subtotal*Number(taxRate||0)/100;
  const total=Math.max(0,subtotal-Number(discountLkr||0)+tax);
  const received=Number(amountReceivedLkr||0);
  if(paymentMethod==="cash"&&received<total) throw Object.assign(new Error("Amount received is less than total."),{status:400});
  const change=paymentMethod==="cash"?received-total:0;
  const sr=await c.query(`INSERT INTO sales(branch_id,invoice_number,cashier_id,customer_id,subtotal_lkr,discount_lkr,tax_lkr,total_lkr,payment_method,amount_received_lkr,change_lkr,offline_reference)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
  [req.user.branchId,invoice(),req.user.id,customerId||null,subtotal,discountLkr,tax,total,paymentMethod,received,change,offlineReference||null]);
  for(const x of prepared){
    await c.query(`INSERT INTO sale_items(sale_id,product_id,product_name,sku,quantity,unit_price_lkr,cost_price_lkr,line_total_lkr)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[sr.rows[0].id,x.p.id,x.p.name,x.p.sku,x.q,x.p.selling_price_lkr,x.p.cost_price_lkr,x.line]);
    await c.query("UPDATE branch_inventory SET stock_quantity=stock_quantity-$1 WHERE branch_id=$2 AND product_id=$3",[x.q,req.user.branchId,x.p.id]);
    await c.query(`INSERT INTO stock_movements(branch_id,product_id,movement_type,quantity,reference_type,reference_id,created_by)
    VALUES($1,$2,'sale',$3,'sale',$4,$5)`,[req.user.branchId,x.p.id,x.q,sr.rows[0].id,req.user.id]);
  }
  if(customerId) await c.query("UPDATE customers SET loyalty_points=loyalty_points+FLOOR($1/1000) WHERE id=$2",[total,customerId]);
  await c.query("COMMIT");
  res.status(201).json({...sr.rows[0],items:prepared.map(x=>({name:x.p.name,sku:x.p.sku,quantity:x.q,unitPrice:x.p.selling_price_lkr,lineTotal:x.line}))});
 }catch(e){await c.query("ROLLBACK");console.error(e);res.status(e.status||500).json({message:e.message||"Sale failed."});}
 finally{c.release();}
});

router.get("/",requireAuth,async(req,res)=>{
 const r=await pool.query(`SELECT s.*,u.name cashier_name,c.name customer_name
 FROM sales s JOIN users u ON u.id=s.cashier_id LEFT JOIN customers c ON c.id=s.customer_id
 WHERE s.branch_id=$1 ORDER BY s.created_at DESC LIMIT 200`,[req.user.branchId]);
 res.json(r.rows);
});

router.get("/:id",requireAuth,async(req,res)=>{
 const s=await pool.query(`SELECT s.*,u.name cashier_name,c.name customer_name FROM sales s
 JOIN users u ON u.id=s.cashier_id LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=$1 AND s.branch_id=$2`,[req.params.id,req.user.branchId]);
 if(!s.rowCount)return res.status(404).json({message:"Sale not found."});
 const items=await pool.query("SELECT * FROM sale_items WHERE sale_id=$1",[req.params.id]);
 res.json({...s.rows[0],items:items.rows});
});

router.get("/:id/receipt",requireAuth,async(req,res)=>{
 const s=await pool.query(`SELECT s.*,u.name cashier_name,c.name customer_name FROM sales s
 JOIN users u ON u.id=s.cashier_id LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id=$1 AND s.branch_id=$2`,[req.params.id,req.user.branchId]);
 if(!s.rowCount)return res.status(404).json({message:"Sale not found."});
 const items=await pool.query("SELECT * FROM sale_items WHERE sale_id=$1",[req.params.id]);
 const x=s.rows[0];
 res.setHeader("Content-Type","application/pdf");
 res.setHeader("Content-Disposition",`attachment; filename=${x.invoice_number}.pdf`);
 const doc=new PDFDocument({size:[226.77,600],margin:16});doc.pipe(res);
 doc.fontSize(14).text("RetailFlow POS",{align:"center"}).fontSize(8).text("Sales Receipt",{align:"center"}).moveDown();
 doc.text(`Invoice: ${x.invoice_number}`);doc.text(`Date: ${new Date(x.created_at).toLocaleString("en-LK")}`);doc.text(`Cashier: ${x.cashier_name}`);if(x.customer_name)doc.text(`Customer: ${x.customer_name}`);doc.moveDown();
 items.rows.forEach(i=>{doc.text(i.product_name);doc.text(`${i.quantity} x LKR ${Number(i.unit_price_lkr).toFixed(2)} = LKR ${Number(i.line_total_lkr).toFixed(2)}`);});
 doc.moveDown();doc.text(`Subtotal: LKR ${Number(x.subtotal_lkr).toFixed(2)}`,{align:"right"});doc.text(`Discount: LKR ${Number(x.discount_lkr).toFixed(2)}`,{align:"right"});doc.text(`Tax: LKR ${Number(x.tax_lkr).toFixed(2)}`,{align:"right"});doc.fontSize(10).text(`Total: LKR ${Number(x.total_lkr).toFixed(2)}`,{align:"right"});doc.fontSize(8).text(`Payment: ${x.payment_method}`,{align:"right"});doc.text(`Change: LKR ${Number(x.change_lkr).toFixed(2)}`,{align:"right"});doc.moveDown().text("Thank you!",{align:"center"});doc.end();
});
export default router;

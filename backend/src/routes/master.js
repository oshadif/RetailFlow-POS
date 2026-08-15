import {Router} from "express";
import bcrypt from "bcryptjs";
import {pool} from "../db.js";
import {requireAuth,requireAdmin} from "../middleware/auth.js";
const router=Router();

for(const [path,table] of [["categories","categories"],["suppliers","suppliers"],["customers","customers"]]){
 router.get(`/${path}`,requireAuth,async(req,res)=>{const r=await pool.query(`SELECT * FROM ${table} ORDER BY name`);res.json(r.rows);});
}
router.post("/categories",requireAuth,requireAdmin,async(req,res)=>{const r=await pool.query("INSERT INTO categories(name,description) VALUES($1,$2) RETURNING *",[req.body.name,req.body.description||""]);res.status(201).json(r.rows[0]);});
router.post("/suppliers",requireAuth,requireAdmin,async(req,res)=>{const b=req.body;const r=await pool.query("INSERT INTO suppliers(name,phone,email,address) VALUES($1,$2,$3,$4) RETURNING *",[b.name,b.phone||"",b.email||"",b.address||""]);res.status(201).json(r.rows[0]);});
router.post("/customers",requireAuth,async(req,res)=>{const b=req.body;const r=await pool.query("INSERT INTO customers(name,phone,email) VALUES($1,$2,$3) RETURNING *",[b.name,b.phone||"",b.email||""]);res.status(201).json(r.rows[0]);});
router.get("/users",requireAuth,requireAdmin,async(req,res)=>{const r=await pool.query("SELECT id,name,email,role,active,created_at FROM users ORDER BY name");res.json(r.rows);});
router.post("/users",requireAuth,requireAdmin,async(req,res)=>{const b=req.body;const hash=await bcrypt.hash(b.password,12);const r=await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,active",[b.name,b.email.toLowerCase(),hash,b.role]);res.status(201).json(r.rows[0]);});
export default router;

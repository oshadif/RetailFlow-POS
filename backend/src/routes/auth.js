import {Router} from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {pool} from "../db.js";
const router=Router();
router.post("/login",async(req,res)=>{
 try{
  const r=await pool.query(`SELECT u.*,b.code branch_code,b.name branch_name FROM users u
  LEFT JOIN branches b ON b.id=u.branch_id WHERE u.email=$1 AND u.active=true`,[req.body.email?.toLowerCase()]);
  const u=r.rows[0];
  if(!u||!(await bcrypt.compare(req.body.password||"",u.password_hash))) return res.status(401).json({message:"Invalid email or password."});
  const user={id:u.id,name:u.name,email:u.email,role:u.role,branchId:u.branch_id,branchCode:u.branch_code,branchName:u.branch_name};
  const token=jwt.sign(user,process.env.JWT_SECRET,{expiresIn:"7d"});
  res.json({user,token});
 }catch(e){console.error(e);res.status(500).json({message:"Login failed."});}
});
export default router;

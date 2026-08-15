import jwt from "jsonwebtoken";
export function requireAuth(req,res,next){
  const header=req.headers.authorization;
  if(!header?.startsWith("Bearer ")) return res.status(401).json({message:"Authentication required."});
  try{req.user=jwt.verify(header.split(" ")[1],process.env.JWT_SECRET);next();}
  catch{return res.status(401).json({message:"Invalid or expired token."});}
}
export function requireAdmin(req,res,next){
  if(req.user?.role!=="admin") return res.status(403).json({message:"Admin access required."});
  next();
}

export const API_URL=import.meta.env.VITE_API_URL||"http://localhost:5000/api";
export async function api(path,options={}){const token=localStorage.getItem("token");const r=await fetch(`${API_URL}${path}`,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}) ,...(options.headers||{})}});const d=r.status===204?null:await r.json();if(!r.ok)throw new Error(d?.message||"Request failed.");return d;}
export const money=v=>new Intl.NumberFormat("en-LK",{style:"currency",currency:"LKR",maximumFractionDigits:2}).format(Number(v||0));

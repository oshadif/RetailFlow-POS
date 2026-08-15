const KEY="retailflow-offline-sales";
export function saveOfflineSale(sale){
 const q=JSON.parse(localStorage.getItem(KEY)||"[]");
 q.push(sale);localStorage.setItem(KEY,JSON.stringify(q));
}
export function getOfflineSales(){return JSON.parse(localStorage.getItem(KEY)||"[]");}
export function setOfflineSales(q){localStorage.setItem(KEY,JSON.stringify(q));}
export async function syncOfflineSales(api){
 const q=getOfflineSales(),failed=[];
 for(const sale of q){try{await api("/sales",{method:"POST",body:JSON.stringify(sale)});}catch{failed.push(sale);}}
 setOfflineSales(failed);return {synced:q.length-failed.length,remaining:failed.length};
}

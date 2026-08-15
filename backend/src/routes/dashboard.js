import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const branchId = req.user.branchId;

  const [today, products, lowStock, topProducts, recentSales] =
    await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS sales_count,
           COALESCE(SUM(total_lkr),0) AS revenue,
           COALESCE(
             SUM(total_lkr) -
             SUM((
               SELECT COALESCE(SUM(quantity * cost_price_lkr),0)
               FROM sale_items
               WHERE sale_id=s.id
             )),
             0
           ) AS profit
         FROM sales s
         WHERE branch_id=$1
           AND created_at::date=CURRENT_DATE
           AND status IN ('completed','partially_refunded')`,
        [branchId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM products
         WHERE active=true`
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM products p
         LEFT JOIN branch_inventory i
           ON i.product_id=p.id AND i.branch_id=$1
         WHERE p.active=true
           AND COALESCE(i.stock_quantity,0) <= p.reorder_level`,
        [branchId]
      ),
      pool.query(
        `SELECT si.product_name,
                SUM(si.quantity - si.returned_quantity)::numeric AS quantity,
                SUM((si.quantity - si.returned_quantity) * si.unit_price_lkr)::numeric AS revenue
         FROM sale_items si
         JOIN sales s ON s.id=si.sale_id
         WHERE s.branch_id=$1
         GROUP BY si.product_name
         ORDER BY quantity DESC
         LIMIT 5`,
        [branchId]
      ),
      pool.query(
        `SELECT id,invoice_number,total_lkr,payment_method,status,created_at
         FROM sales
         WHERE branch_id=$1
         ORDER BY created_at DESC
         LIMIT 8`,
        [branchId]
      ),
    ]);

  res.json({
    today: today.rows[0],
    products: products.rows[0].count,
    lowStock: lowStock.rows[0].count,
    topProducts: topProducts.rows,
    recentSales: recentSales.rows,
  });
});

export default router;

import { Router } from "express";
import net from "node:net";
import { pool } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { audit } from "../middleware/audit.js";

const router = Router();

function escposReceipt(sale, items) {
  const ESC = "\x1B";
  const GS = "\x1D";
  let output = "";

  output += `${ESC}@`;
  output += `${ESC}a\x01`;
  output += "RetailFlow POS\n";
  output += "Sales Receipt\n";
  output += `${ESC}a\x00`;
  output += "--------------------------------\n";
  output += `Invoice: ${sale.invoice_number}\n`;
  output += `Date: ${new Date(sale.created_at).toLocaleString("en-LK")}\n`;
  output += "--------------------------------\n";

  for (const item of items) {
    output += `${item.product_name}\n`;
    output += `${item.quantity} x LKR ${Number(item.unit_price_lkr).toFixed(2)} = LKR ${Number(item.line_total_lkr).toFixed(2)}\n`;
  }

  output += "--------------------------------\n";
  output += `Total: LKR ${Number(sale.total_lkr).toFixed(2)}\n`;
  output += `Payment: ${sale.payment_method}\n`;
  output += `Change: LKR ${Number(sale.change_lkr).toFixed(2)}\n`;
  output += "\nThank you!\n\n\n";
  output += `${GS}V\x00`;

  return Buffer.from(output, "binary");
}

async function sendToPrinter(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
      socket.write(data, () => socket.end());
    });

    socket.on("close", resolve);
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Printer connection timed out."));
    });
  });
}

router.get("/config", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM printer_configs WHERE branch_id=$1",
    [req.user.branchId]
  );
  res.json(result.rows[0] || null);
});

router.put(
  "/config",
  requireAuth,
  requireAdmin,
  audit("printer_config_update", "printer_config"),
  async (req, res) => {
    const body = req.body;
    const result = await pool.query(
      `INSERT INTO printer_configs
       (branch_id,printer_type,host,port,paper_width_mm,enabled)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(branch_id) DO UPDATE SET
         printer_type=EXCLUDED.printer_type,
         host=EXCLUDED.host,
         port=EXCLUDED.port,
         paper_width_mm=EXCLUDED.paper_width_mm,
         enabled=EXCLUDED.enabled
       RETURNING *`,
      [
        req.user.branchId,
        body.printerType || "network",
        body.host,
        body.port || 9100,
        body.paperWidthMm || 80,
        Boolean(body.enabled),
      ]
    );
    res.json(result.rows[0]);
  }
);

router.post("/test", requireAuth, async (req, res) => {
  const configResult = await pool.query(
    "SELECT * FROM printer_configs WHERE branch_id=$1",
    [req.user.branchId]
  );
  const config = configResult.rows[0];

  if (!config?.enabled) {
    return res.status(400).json({ message: "Printer is not enabled." });
  }

  const testData = Buffer.from(
    "\x1B@Test print successful\nRetailFlow POS\n\n\n\x1DV\x00",
    "binary"
  );

  try {
    await sendToPrinter(config.host, config.port, testData);
    res.json({ message: "Test print sent." });
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

router.post("/sales/:id/print", requireAuth, async (req, res) => {
  const saleResult = await pool.query(
    "SELECT * FROM sales WHERE id=$1 AND branch_id=$2",
    [req.params.id, req.user.branchId]
  );

  if (!saleResult.rowCount) {
    return res.status(404).json({ message: "Sale not found." });
  }

  const itemsResult = await pool.query(
    "SELECT * FROM sale_items WHERE sale_id=$1",
    [req.params.id]
  );
  const configResult = await pool.query(
    "SELECT * FROM printer_configs WHERE branch_id=$1",
    [req.user.branchId]
  );
  const config = configResult.rows[0];

  if (!config?.enabled) {
    return res.status(400).json({ message: "Printer is not enabled." });
  }

  try {
    await sendToPrinter(
      config.host,
      config.port,
      escposReceipt(saleResult.rows[0], itemsResult.rows)
    );
    res.json({ message: "Receipt sent to printer." });
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

export default router;

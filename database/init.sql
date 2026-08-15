CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Colombo',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'cashier',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(180),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(180),
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  name VARCHAR(180) NOT NULL,
  sku VARCHAR(80) UNIQUE NOT NULL,
  barcode VARCHAR(120) UNIQUE,
  description TEXT,
  cost_price_lkr NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price_lkr NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12,2) NOT NULL DEFAULT 5,
  unit VARCHAR(30) NOT NULL DEFAULT 'item',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_inventory (
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY(branch_id, product_id)
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  invoice_number VARCHAR(40) UNIQUE NOT NULL,
  cashier_id UUID NOT NULL REFERENCES users(id),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal_lkr NUMERIC(12,2) NOT NULL,
  discount_lkr NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_lkr NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_lkr NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,
  amount_received_lkr NUMERIC(12,2) NOT NULL,
  change_lkr NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  offline_reference VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name VARCHAR(180) NOT NULL,
  sku VARCHAR(80) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  unit_price_lkr NUMERIC(12,2) NOT NULL,
  cost_price_lkr NUMERIC(12,2) NOT NULL,
  line_total_lkr NUMERIC(12,2) NOT NULL,
  returned_quantity NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  return_number VARCHAR(40) UNIQUE NOT NULL,
  sale_id UUID NOT NULL REFERENCES sales(id),
  processed_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  refund_method VARCHAR(30) NOT NULL,
  refund_amount_lkr NUMERIC(12,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,2) NOT NULL,
  refund_amount_lkr NUMERIC(12,2) NOT NULL,
  restock BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(40) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  reference_type VARCHAR(40),
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80),
  entity_id UUID,
  method VARCHAR(10),
  path TEXT,
  ip_address VARCHAR(80),
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID UNIQUE NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  printer_type VARCHAR(30) NOT NULL DEFAULT 'network',
  host VARCHAR(180),
  port INTEGER NOT NULL DEFAULT 9100,
  paper_width_mm INTEGER NOT NULL DEFAULT 80,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO branches(code,name,address,phone)
VALUES ('COL-01','Colombo Main Branch','Colombo, Sri Lanka','0112345678'),
       ('GAM-01','Gampaha Branch','Gampaha, Sri Lanka','0332345678')
ON CONFLICT(code) DO NOTHING;

INSERT INTO users(branch_id,name,email,password_hash,role)
SELECT id,'Demo Admin','admin@demo.com',crypt('admin123',gen_salt('bf')),'admin'
FROM branches WHERE code='COL-01'
ON CONFLICT(email) DO NOTHING;

INSERT INTO users(branch_id,name,email,password_hash,role)
SELECT id,'Demo Cashier','cashier@demo.com',crypt('cashier123',gen_salt('bf')),'cashier'
FROM branches WHERE code='COL-01'
ON CONFLICT(email) DO NOTHING;

INSERT INTO categories(name,description) VALUES
('Beverages','Drinks and refreshments'),
('Groceries','Daily grocery items'),
('Personal Care','Personal care products'),
('Snacks','Snack products')
ON CONFLICT(name) DO NOTHING;

INSERT INTO suppliers(name,phone,email,address) VALUES
('Lanka Wholesale Traders','0112345678','sales@lankawholesale.example','Colombo'),
('Island Distributors','0771234567','orders@islanddist.example','Gampaha');

INSERT INTO customers(name,phone,email,loyalty_points) VALUES
('Walk-in Customer',NULL,NULL,0),
('Nimal Perera','0711111111','nimal@example.com',120);

INSERT INTO products(category_id,supplier_id,name,sku,barcode,description,cost_price_lkr,selling_price_lkr,reorder_level,unit)
SELECT c.id,s.id,'Bottled Water 1L','BEV-001','890100000001','One litre drinking water',80,120,10,'bottle'
FROM categories c,suppliers s WHERE c.name='Beverages' AND s.name='Lanka Wholesale Traders'
ON CONFLICT(sku) DO NOTHING;

INSERT INTO products(category_id,supplier_id,name,sku,barcode,description,cost_price_lkr,selling_price_lkr,reorder_level,unit)
SELECT c.id,s.id,'Milk Powder 400g','GRO-001','890100000002','Full cream milk powder',950,1150,8,'packet'
FROM categories c,suppliers s WHERE c.name='Groceries' AND s.name='Island Distributors'
ON CONFLICT(sku) DO NOTHING;

INSERT INTO products(category_id,supplier_id,name,sku,barcode,description,cost_price_lkr,selling_price_lkr,reorder_level,unit)
SELECT c.id,s.id,'Chocolate Biscuit Pack','SNK-001','890100000003','Chocolate cream biscuits',180,240,10,'packet'
FROM categories c,suppliers s WHERE c.name='Snacks' AND s.name='Lanka Wholesale Traders'
ON CONFLICT(sku) DO NOTHING;

INSERT INTO products(category_id,supplier_id,name,sku,barcode,description,cost_price_lkr,selling_price_lkr,reorder_level,unit)
SELECT c.id,s.id,'Shampoo 180ml','PER-001','890100000004','Daily care shampoo',520,690,6,'bottle'
FROM categories c,suppliers s WHERE c.name='Personal Care' AND s.name='Island Distributors'
ON CONFLICT(sku) DO NOTHING;

INSERT INTO branch_inventory(branch_id,product_id,stock_quantity)
SELECT b.id,p.id,CASE WHEN b.code='COL-01' THEN 40 ELSE 20 END
FROM branches b CROSS JOIN products p
ON CONFLICT(branch_id,product_id) DO NOTHING;

INSERT INTO printer_configs(branch_id,host,port,enabled)
SELECT id,'192.168.1.100',9100,FALSE FROM branches
ON CONFLICT(branch_id) DO NOTHING;

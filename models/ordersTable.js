import database from "../database/db.js";
export async function createOrdersTable() {
  try {
    const query = `CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID NOT NULL,
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    tax_price DECIMAL(10,2) NOT NULL CHECK (tax_price >= 0),
    shipping_price DECIMAL(10,2) NOT NULL CHECK (shipping_price >= 0),
    order_status VARCHAR(50) DEFAULT 'Processing' CHECK (order_status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned')),
    paid_at TIMESTAMP CHECK (paid_at IS NULL OR paid_at <= CURRENT_TIMESTAMP),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE);`;
    await database.query(query);

    // Migration: add Returned to existing tables
    await database.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
    `);
    await database.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_order_status_check
        CHECK (order_status IN ('Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'));
    `);

    console.log("✅ Orders table created successfully.");
  } catch (error) {
    console.error("❌ Failed To Create Orders Table.", error);
    process.exit(1);
  }
}

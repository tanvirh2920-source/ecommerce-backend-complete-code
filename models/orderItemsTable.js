import database from "../database/db.js";
export async function createOrderItemTable() {
  try {
    const query = `CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image TEXT NOT NULL,
    title TEXT NOT NULL,
    size VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE);`;
    await database.query(query);

    // Migration: add size column if it doesn't exist yet
    await database.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(20) DEFAULT NULL;
    `);

    console.log("✅ Ordered Items table created successfully.");
  } catch (error) {
    console.error("❌ Failed To Create Ordered Items Table.", error);
    process.exit(1);
  }
}

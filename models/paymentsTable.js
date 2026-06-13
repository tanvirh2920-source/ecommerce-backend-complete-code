import database from "../database/db.js";

export async function createPaymentsTable() {
  try {
    const query = `CREATE TABLE IF NOT EXISTS payments(
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('Online', 'Cash On Delivery')),
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('Paid', 'Pending', 'Failed', 'Cancelled', 'Refunded')),
    payment_intent_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE);`;
    await database.query(query);

    // Migration: add Refunded and Cancelled to existing tables
    await database.query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_status_check;
    `);
    await database.query(`
      ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check
        CHECK (payment_status IN ('Paid', 'Pending', 'Failed', 'Cancelled', 'Refunded'));
    `);

    console.log("✅ Payments table created successfully.");
  } catch (error) {
    console.error("❌ Failed To Create Payments Table.", error);
    process.exit(1);
  }
}

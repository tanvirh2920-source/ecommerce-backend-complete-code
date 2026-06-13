import database from "../database/db.js";

export async function createReturnRequestsTable() {
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS return_requests (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        order_id UUID NOT NULL,
        buyer_id UUID NOT NULL,
        reason VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
        admin_note TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (order_id)
      );
    `);
    console.log("✅ Return requests table created successfully.");
  } catch (error) {
    console.error("❌ Failed To Create Return Requests Table.", error);
  }
}

import database from "../database/db.js";

export async function createContactMessagesTable() {
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Migration: add phone column if it doesn't exist
    await database.query(`
      ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
    `);
    console.log("✅ Contact messages table created successfully.");
  } catch (error) {
    console.error("❌ Failed To Create Contact Messages Table.", error);
  }
}

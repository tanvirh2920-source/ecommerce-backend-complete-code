import database from "../database/db.js";

export async function createNewsletterTable() {
  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Newsletter table created successfully.");
  } catch (error) {
    console.error("❌ Failed To Create Newsletter Table.", error);
  }
}

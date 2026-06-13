import database from "../database/db.js";

export async function createUserTable() {
  try {
    const query = `
        Create Table IF NOT EXISTS users (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(100) NOT NULL CHECK (char_length(name) > 3),
            email VARCHAR(100) UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone VARCHAR(20) DEFAULT NULL,
            role VARCHAR(50) DEFAULT 'User' CHECK (role IN ('User', 'Admin')),
            avatar JSONB DEFAULT NULL,
            reset_password_token TEXT DEFAULT NULL,
            reset_password_expire TIMESTAMPTZ DEFAULT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
       `;

    await database.query(query);

    // Migration: add phone column if it doesn't exist yet
    await database.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL;
    `);

    // Migration: add OTP columns for email verification
    await database.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6) DEFAULT NULL;
    `);
    await database.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expire TIMESTAMPTZ DEFAULT NULL;
    `);
    await database.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    `);

    console.log("✅ User Table table created successfully.");
  } catch (error) {
    console.error("❌ Failed To Create User Table.", error);
    process.exit(1);
  }
}

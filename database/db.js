import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

dotenv.config({ path: ".env", override: false });

// Use DATABASE_URL (Render/production) or individual vars (local)
const database = process.env.DATABASE_URL
  ? new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Render PostgreSQL
    })
  : new Client({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "ecommerce_store",
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT || 5432),
      ssl: process.env.DB_HOST?.includes("neon") || process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    });

export const connectDB = async () => {
    try {
        await database.connect();
        console.log("Database connected successfully");
    } catch (error) {
        console.error("Database connection failed:", error);
        throw error;
    }
};

export default database;
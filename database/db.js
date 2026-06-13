import dotenv from "dotenv";
import pkg from "pg";

const { Pool } = pkg;

dotenv.config({ path: ".env", override: false });

const isNeon = Boolean(process.env.DATABASE_URL || process.env.DB_HOST?.includes("neon"));

const database = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "ecommerce_store",
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: isNeon ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

database.on("error", (err) => {
  console.error("Unexpected DB pool error:", err);
});

export const connectDB = async () => {
  try {
    await database.query("SELECT 1");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
};

export default database;
import "./config/cloudinaryConfig.js";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import { createTables } from "./utils/createTables.js";
import { createNewsletterTable } from "./models/newsletterTable.js";import { connectDB } from "./database/db.js";
import { errorMiddleware } from "./middlewares/errorMiddlewares.js";
import authRouter from "./router/authRouters.js";
import productRouter from "./router/productRouters.js";
import adminRouter from "./router/adminRoute.js";
import orderRouter from "./router/orderRouters.js";
import paymentRouter from "./router/paymentRouters.js";
import newsletterRouter from "./router/newsletterRouters.js";
import returnRouter from "./router/returnRouters.js";
import contactRouter from "./router/contactRouters.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: ".env", override: false });
app.use(
    cors({
    origin: [process.env.FRONTEND_URL, process.env.DASHBOARD_URL],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
})
);

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(cookieParser());
app.use(
    fileUpload({
        tempFileDir:"./uploads",
        useTempFiles: true,
    })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/newsletter", newsletterRouter);
app.use("/api/v1/returns", returnRouter);
app.use("/api/v1/contact", contactRouter);
app.use(errorMiddleware);

await connectDB(); 
await createTables();
await createNewsletterTable();

export default app;
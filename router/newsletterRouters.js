import express from "express";
import { subscribe, getAllSubscribers } from "../controllers/newsletterController.js";
import { isAuthenticated, authorizeRoles } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/subscribe", subscribe);
router.get("/subscribers", isAuthenticated, authorizeRoles("Admin"), getAllSubscribers);

export default router;

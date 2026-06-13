import express from "express";
import {
  submitContactMessage,
  getAllContactMessages,
  markMessageAsRead,
  deleteContactMessage,
} from "../controllers/contactController.js";
import { isAuthenticated, authorizeRoles } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Public (requires login — enforced on client and server)
router.post("/submit", isAuthenticated, submitContactMessage);

// Admin
router.get("/admin/all", isAuthenticated, authorizeRoles("Admin"), getAllContactMessages);
router.put("/admin/:messageId/read", isAuthenticated, authorizeRoles("Admin"), markMessageAsRead);
router.delete("/admin/:messageId", isAuthenticated, authorizeRoles("Admin"), deleteContactMessage);

export default router;

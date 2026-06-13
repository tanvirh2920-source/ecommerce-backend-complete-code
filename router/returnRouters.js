import express from "express";
import {
  createReturnRequest,
  getMyReturnRequests,
  getAllReturnRequests,
  updateReturnRequest,
} from "../controllers/returnController.js";
import { isAuthenticated, authorizeRoles } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// User routes — static routes MUST come before parameterized routes
router.get("/my/requests", isAuthenticated, getMyReturnRequests);

// Admin routes
router.get("/admin/all", isAuthenticated, authorizeRoles("Admin"), getAllReturnRequests);
router.put("/admin/:returnId", isAuthenticated, authorizeRoles("Admin"), updateReturnRequest);

// Parameterized route last
router.post("/:orderId", isAuthenticated, createReturnRequest);

export default router;

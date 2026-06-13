import express from "express";
import { getAllUsers, deleteUser, dashboardStats, generateReport } from "../controllers/adminController.js";
import {
  authorizeRoles,
  isAuthenticated,
} from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/getallusers", isAuthenticated, authorizeRoles("Admin"), getAllUsers);
router.delete("/deleteuser/:id", isAuthenticated, authorizeRoles("Admin"), deleteUser);
router.get("/fetch/dashboard-stats", isAuthenticated, authorizeRoles("Admin"), dashboardStats);
router.get("/fetch/report", isAuthenticated, authorizeRoles("Admin"), generateReport);

export default router;

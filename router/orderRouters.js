import express from "express";
import {
  fetchSingleOrder,
  placeNewOrder,
  fetchMyOrders,
  fetchAllOrders,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/orderControllers.js";
import {
  isAuthenticated,
  authorizeRoles,
} from "../middlewares/authMiddlewares.js";


// Bug 28 FIX: /admin/getall was unreachable — /:orderId matched it first
const router = express.Router();
router.post("/new", isAuthenticated, placeNewOrder);
router.get("/me", isAuthenticated, fetchMyOrders);
router.get("/admin/getall", isAuthenticated, authorizeRoles("Admin"), fetchAllOrders);  // specific before generic
router.put("/admin/update/:orderId", isAuthenticated, authorizeRoles("Admin"), updateOrderStatus);
router.delete("/admin/delete/:orderId", isAuthenticated, authorizeRoles("Admin"), deleteOrder);
router.get("/:orderId", isAuthenticated, fetchSingleOrder);  // generic last

export default router;

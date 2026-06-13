import express from "express";
import { isAuthenticated } from "../middlewares/authMiddlewares.js";
import {
  initiatePayment,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIPN,
} from "../controllers/paymentController.js";

const router = express.Router();

// Initiate payment
router.post("/initiate", isAuthenticated, initiatePayment);

// Payment callbacks (called by SSLCommerz — supports both POST and GET)
router.post("/success", paymentSuccess);
router.get("/success", paymentSuccess);
router.post("/fail", paymentFail);
router.get("/fail", paymentFail);
router.post("/cancel", paymentCancel);
router.get("/cancel", paymentCancel);
router.post("/ipn", paymentIPN);

export default router;
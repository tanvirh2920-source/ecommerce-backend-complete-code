import { isAuthenticated } from "../middlewares/authMiddlewares.js";
import express from "express";
import { 
 getUser, 
 login, 
 logout,
 register,
 verifyOTP,
 resendOTP,
 forgotPassword,
 resetPassword,
 updatePassword,
 updateProfile,
 } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/register/verify-otp", verifyOTP);
router.post("/register/resend-otp", resendOTP);
router.post("/login", login);
router.get("/me", isAuthenticated, getUser);
router.get("/logout", isAuthenticated, logout);
router.post("/password/forgot", forgotPassword);
router.put("/password/reset/:token", resetPassword);
router.put("/password/update", isAuthenticated, updatePassword);
router.put("/profile/update", isAuthenticated, updateProfile);

export default router;
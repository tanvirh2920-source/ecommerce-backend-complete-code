import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import database from "../database/db.js";
import bcrypt from "bcrypt";
import { sendToken } from "../utils/jwtToken.js";
import { generateResetPasswordToken } from "../utils/generateResetPasswordToken.js";
import { generateEmailTemplate } from "../utils/generateForgotPasswordEmailTemplate.js";
import { sendEmail } from "../utils/sendemail.js";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register a user
export const register = catchAsyncError(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return next(
      new ErrorHandler("Please provides all the required fields", 400),
    );
  }

  if (password.length < 8 || password.length > 16) {
    return next(
      new ErrorHandler("Password must be between 8 and 16 characters", 400),
    );
  }

  if (phone && !/^01[3-9]\d{8}$/.test(phone)) {
    return next(
      new ErrorHandler("Please provide a valid 11-digit BD phone number", 400),
    );
  }

  const isAlreadyRegistered = await database.query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = TRUE",
    [email],
  );

  if (isAlreadyRegistered.rows.length > 0) {
    return next(new ErrorHandler("User already registered", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Delete any previous unverified entry for this email
  await database.query(
    "DELETE FROM users WHERE email = $1 AND is_verified = FALSE",
    [email],
  );

  // Insert user as unverified with OTP
  await database.query(
    "INSERT INTO users (name, email, password, phone, otp_code, otp_expire, is_verified) VALUES ($1, $2, $3, $4, $5, $6, FALSE)",
    [name, email, hashedPassword, phone || null, otp, otpExpire],
  );

  // Send OTP email
  const otpEmailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f9f9f9; border-radius: 10px;">
      <h2 style="color: #7c3aed; text-align: center;">Daily Bazar - Email Verification</h2>
      <p style="color: #374151;">Hello <strong>${name}</strong>,</p>
      <p style="color: #374151;">Your OTP code for account verification is:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #7c3aed; background: #f3f0ff; padding: 15px 30px; border-radius: 10px; border: 2px dashed #7c3aed;">
          ${otp}
        </span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      email,
      subject: "Daily Bazar - Email Verification OTP",
      message: otpEmailTemplate,
    });

    res.status(200).json({
      success: true,
      message: `OTP sent to ${email}. Please verify to complete registration.`,
    });
  } catch (error) {
    await database.query(
      "DELETE FROM users WHERE email = $1 AND is_verified = FALSE",
      [email],
    );
    return next(
      new ErrorHandler("Failed to send OTP email. Please try again.", 500),
    );
  }
});

// Verify OTP and complete registration
export const verifyOTP = catchAsyncError(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new ErrorHandler("Please provide email and OTP", 400));
  }

  const userResult = await database.query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = FALSE AND otp_code = $2 AND otp_expire > NOW()",
    [email, otp],
  );

  if (userResult.rows.length === 0) {
    return next(
      new ErrorHandler("Invalid or expired OTP. Please try again.", 400),
    );
  }

  // Mark user as verified and clear OTP
  const verifiedUser = await database.query(
    "UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expire = NULL WHERE email = $1 RETURNING *",
    [email],
  );

  sendToken(
    verifiedUser.rows[0],
    201,
    "Account verified and registered successfully",
    res,
  );
});

// Resend OTP
export const resendOTP = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorHandler("Please provide email", 400));
  }

  const userResult = await database.query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = FALSE",
    [email],
  );

  if (userResult.rows.length === 0) {
    return next(
      new ErrorHandler("No pending registration found for this email", 404),
    );
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpire = new Date(Date.now() + 10 * 60 * 1000);

  await database.query(
    "UPDATE users SET otp_code = $1, otp_expire = $2 WHERE email = $3 AND is_verified = FALSE",
    [otp, otpExpire, email],
  );

  const otpEmailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f9f9f9; border-radius: 10px;">
      <h2 style="color: #7c3aed; text-align: center;">Daily Bazar - New OTP Code</h2>
      <p style="color: #374151;">Your new OTP code is:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #7c3aed; background: #f3f0ff; padding: 15px 30px; border-radius: 10px; border: 2px dashed #7c3aed;">
          ${otp}
        </span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Valid for <strong>10 minutes</strong>.</p>
    </div>
  `;

  try {
    await sendEmail({
      email,
      subject: "Daily Bazar - New OTP Code",
      message: otpEmailTemplate,
    });
    res
      .status(200)
      .json({ success: true, message: `New OTP sent to ${email}` });
  } catch (error) {
    return next(new ErrorHandler("Failed to send OTP. Please try again.", 500));
  }
});

// Login a user
export const login = catchAsyncError(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password", 400));
  }

  const user = await database.query(
    "SELECT * FROM users WHERE email = $1 AND is_verified = TRUE",
    [email],
  );

  if (user.rows.length === 0) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  const isPassword = await bcrypt.compare(password, user.rows[0].password);

  if (!isPassword) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  sendToken(user.rows[0], 200, "Logged in successfully", res);
});

// Get user details
export const getUser = catchAsyncError(async (req, res, next) => {
  const { user } = req;
  res.status(200).json({
    success: true,
    user,
  });
});

// Logout user
export const logout = catchAsyncError(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    })
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

export const forgotPassword = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;
  const { frontendUrl } = req.query;

  let userResult = await database.query(
    "SELECT * FROM users WHERE email = $1",
    [email],
  );

  // Always return the same message to prevent email enumeration
  const genericMessage = `If an account with ${email} exists, a reset link has been sent.`;

  if (userResult.rows.length === 0) {
    return res.status(200).json({ success: true, message: genericMessage });
  }

  const user = userResult.rows[0];
  const { resetToken, hashedToken, resetPasswordExpireTime } =
    generateResetPasswordToken();

  await database.query(
    "UPDATE users SET reset_password_token = $1, reset_password_expire = to_timestamp($2) WHERE email = $3",
    [hashedToken, resetPasswordExpireTime / 1000, email],
  );

  const resetPasswordUrl = `${frontendUrl}/password/reset/${resetToken}`;
  const message = generateEmailTemplate(resetPasswordUrl, user.name);

  try {
    await sendEmail({
      email: user.email,
      subject: "E-commerce Password Recovery",
      message,
    });
    res.status(200).json({ success: true, message: genericMessage });
  } catch (error) {
    await database.query(
      "UPDATE users SET reset_password_token = NULL, reset_password_expire = NULL WHERE email = $1",
      [email],
    );
    return next(new ErrorHandler("Email could not be sent", 500));
  }
});

// Reset password
export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await database.query(
    "SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expire > NOW()",
    [resetPasswordToken],
  );
  if (user.rows.length === 0) {
    return next(
      new ErrorHandler("Reset password token is invalid or has expired", 400),
    );
  }
  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHandler("Password does not match", 400));
  }
  if (
    req.body.password?.length < 8 ||
    req.body.password?.length > 16 ||
    req.body.confirmPassword?.length < 8 ||
    req.body.confirmPassword?.length > 16
  ) {
    return next(
      new ErrorHandler("Password must be between 8 and 16 characters", 400),
    );
  }
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const updatedUser = await database.query(
    "UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expire = NULL WHERE id = $2 RETURNING *",
    [hashedPassword, user.rows[0].id],
  );
  sendToken(updatedUser.rows[0], 200, "Password reset successfully", res);
});

// Update password
export const updatePassword = catchAsyncError(async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    return next(
      new ErrorHandler("Please provide all the required fields", 400),
    );
  }

  // Fetch full user with password for comparison (isAuthenticated no longer returns password)
  const userResult = await database.query(
    "SELECT password FROM users WHERE id = $1",
    [req.user.id],
  );
  const hashedPassword = userResult.rows[0]?.password;

  const isPasswordMatched = await bcrypt.compare(
    currentPassword,
    hashedPassword,
  );
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Current password is incorrect", 400));
  }
  if (newPassword !== confirmNewPassword) {
    return next(
      new ErrorHandler(
        "New password and confirm new password do not match",
        400,
      ),
    );
  }
  if (
    newPassword.length < 8 ||
    newPassword.length > 16 ||
    confirmNewPassword.length < 8 ||
    confirmNewPassword.length > 16
  ) {
    return next(
      new ErrorHandler("New password must be between 8 and 16 characters", 400),
    );
  }

  const newHashedPassword = await bcrypt.hash(newPassword, 10);

  const updatedUser = await database.query(
    "UPDATE users SET password = $1 WHERE id = $2 RETURNING *",
    [newHashedPassword, req.user.id],
  );
  res.status(200).json({
    success: true,
    message: "Password updated successfully",
    user: updatedUser.rows[0],
  });
});

// Update user profile
export const updateProfile = catchAsyncError(async (req, res, next) => {
  const { name, email, phone } = req.body;

  if (!name || !email) {
    return next(
      new ErrorHandler("Please provide all the required fields", 400),
    );
  }
  if (name.trim().length === 0 || email.trim().length === 0) {
    return next(new ErrorHandler("Name and email cannot be empty", 400));
  }

  // Validate phone if provided
  if (phone && !/^01[3-9]\d{8}$/.test(phone)) {
    return next(
      new ErrorHandler("Please provide a valid 11-digit BD phone number", 400),
    );
  }

  let avatarPath = null;

  if (req.files && req.files.avatar) {
    const avatarFile = req.files.avatar;
    const timestamp = Date.now();
    const fileExtension = path.extname(avatarFile.name);
    const filename = `avatar_${req.user.id}_${timestamp}${fileExtension}`;
    const uploadDir = "./uploads";
    const destination = path.join(uploadDir, filename);
    await avatarFile.mv(destination);
    avatarPath = { url: `/uploads/${filename}` };
  }

  let user;
  if (!avatarPath) {
    user = await database.query(
      "UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING *",
      [name, email, phone || null, req.user.id],
    );
  } else {
    user = await database.query(
      "UPDATE users SET name = $1, email = $2, phone = $3, avatar = $4 WHERE id = $5 RETURNING *",
      [name, email, phone || null, JSON.stringify(avatarPath), req.user.id],
    );
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user: user.rows[0],
  });
});

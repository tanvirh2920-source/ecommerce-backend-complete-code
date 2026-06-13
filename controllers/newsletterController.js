import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import database from "../database/db.js";

// Subscribe to newsletter
export const subscribe = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return next(new ErrorHandler("Please provide a valid email address", 400));
  }

  // Check if already subscribed
  const existing = await database.query(
    "SELECT id FROM newsletter_subscribers WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    return res.status(200).json({
      success: true,
      message: "You are already subscribed to our newsletter!",
    });
  }

  await database.query(
    "INSERT INTO newsletter_subscribers (email) VALUES ($1)",
    [email]
  );

  res.status(201).json({
    success: true,
    message: "Successfully subscribed to our newsletter!",
  });
});

// Admin: get all subscribers
export const getAllSubscribers = catchAsyncError(async (req, res, next) => {
  const result = await database.query(
    "SELECT id, email, subscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC"
  );

  res.status(200).json({
    success: true,
    count: result.rows.length,
    subscribers: result.rows,
  });
});

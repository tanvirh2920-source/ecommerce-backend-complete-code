import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import database from "../database/db.js";

// Authenticated: submit a contact message (email must match logged-in user)
export const submitContactMessage = catchAsyncError(async (req, res, next) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return next(new ErrorHandler("Please fill all fields.", 400));
  }

  // Enforce that the submitted email matches the logged-in user's email
  if (email.trim().toLowerCase() !== req.user.email.toLowerCase()) {
    return next(new ErrorHandler("You can only send messages using your registered email address.", 403));
  }

  await database.query(
    `INSERT INTO contact_messages (name, email, phone, subject, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [name.trim(), email.trim(), phone?.trim() || null, subject.trim(), message.trim()]
  );

  res.status(201).json({
    success: true,
    message: "Your message has been sent successfully!",
  });
});

// Admin: get all contact messages
export const getAllContactMessages = catchAsyncError(async (req, res, next) => {
  const result = await database.query(
    `SELECT * FROM contact_messages ORDER BY created_at DESC`
  );

  res.status(200).json({
    success: true,
    count: result.rows.length,
    unreadCount: result.rows.filter(m => !m.is_read).length,
    messages: result.rows,
  });
});

// Admin: mark message as read
export const markMessageAsRead = catchAsyncError(async (req, res, next) => {
  const { messageId } = req.params;

  const result = await database.query(
    `UPDATE contact_messages SET is_read = TRUE WHERE id = $1 RETURNING *`,
    [messageId]
  );

  if (result.rows.length === 0) {
    return next(new ErrorHandler("Message not found.", 404));
  }

  res.status(200).json({ success: true, message: "Message marked as read." });
});

// Admin: delete a message
export const deleteContactMessage = catchAsyncError(async (req, res, next) => {
  const { messageId } = req.params;

  const result = await database.query(
    `DELETE FROM contact_messages WHERE id = $1 RETURNING *`,
    [messageId]
  );

  if (result.rows.length === 0) {
    return next(new ErrorHandler("Message not found.", 404));
  }

  res.status(200).json({ success: true, message: "Message deleted." });
});

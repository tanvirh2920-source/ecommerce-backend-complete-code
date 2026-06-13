import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import database from "../database/db.js";

const RETURN_WINDOW_DAYS = 7;

// User: submit a return request
export const createReturnRequest = catchAsyncError(async (req, res, next) => {
  const { orderId } = req.params;
  const { reason, description } = req.body;
  const buyerId = req.user.id;

  if (!reason) {
    return next(new ErrorHandler("Please provide a reason for the return.", 400));
  }

  // Verify order belongs to user and is Delivered
  const orderResult = await database.query(
    "SELECT * FROM orders WHERE id = $1 AND buyer_id = $2",
    [orderId, buyerId]
  );

  if (orderResult.rows.length === 0) {
    return next(new ErrorHandler("Order not found.", 404));
  }

  const order = orderResult.rows[0];

  if (order.order_status !== "Delivered") {
    return next(new ErrorHandler("Only delivered orders can be returned.", 400));
  }

  // Check 7-day return window from paid_at
  const paidAt = order.paid_at ? new Date(order.paid_at) : new Date(order.created_at);
  const daysSincePaid = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePaid > RETURN_WINDOW_DAYS) {
    return next(new ErrorHandler(`Return window has expired. Returns are only accepted within ${RETURN_WINDOW_DAYS} days of delivery.`, 400));
  }

  // Check if return request already exists for this order
  const existing = await database.query(
    "SELECT id, status FROM return_requests WHERE order_id = $1",
    [orderId]
  );
  if (existing.rows.length > 0) {
    return next(new ErrorHandler(`A return request already exists for this order (Status: ${existing.rows[0].status}).`, 400));
  }

  const result = await database.query(
    `INSERT INTO return_requests (order_id, buyer_id, reason, description)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [orderId, buyerId, reason, description || null]
  );

  res.status(201).json({
    success: true,
    message: "Return request submitted successfully.",
    returnRequest: result.rows[0],
  });
});

// User: get return request status for their orders
export const getMyReturnRequests = catchAsyncError(async (req, res, next) => {
  const result = await database.query(
    `SELECT rr.*, o.total_price
     FROM return_requests rr
     JOIN orders o ON rr.order_id = o.id
     WHERE rr.buyer_id = $1
     ORDER BY rr.created_at DESC`,
    [req.user.id]
  );

  res.status(200).json({
    success: true,
    returnRequests: result.rows,
  });
});

// Admin: get all return requests
export const getAllReturnRequests = catchAsyncError(async (req, res, next) => {
  const result = await database.query(
    `SELECT rr.*,
            u.name AS buyer_name, u.email AS buyer_email,
            o.total_price,
            si.full_name, si.phone, si.address, si.city, si.state, si.country
     FROM return_requests rr
     JOIN users u ON rr.buyer_id = u.id
     JOIN orders o ON rr.order_id = o.id
     LEFT JOIN shipping_info si ON si.order_id = o.id
     ORDER BY rr.created_at DESC`
  );

  res.status(200).json({
    success: true,
    count: result.rows.length,
    returnRequests: result.rows,
  });
});

// Admin: approve or reject a return request
export const updateReturnRequest = catchAsyncError(async (req, res, next) => {
  const { returnId } = req.params;
  const { status, admin_note } = req.body;

  if (!["Approved", "Rejected"].includes(status)) {
    return next(new ErrorHandler("Status must be 'Approved' or 'Rejected'.", 400));
  }

  const returnResult = await database.query(
    "SELECT * FROM return_requests WHERE id = $1",
    [returnId]
  );

  if (returnResult.rows.length === 0) {
    return next(new ErrorHandler("Return request not found.", 404));
  }

  const returnReq = returnResult.rows[0];

  if (returnReq.status !== "Pending") {
    return next(new ErrorHandler("This return request has already been resolved.", 400));
  }

  // Update return request
  await database.query(
    `UPDATE return_requests
     SET status = $1, admin_note = $2, resolved_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [status, admin_note || null, returnId]
  );

  if (status === "Approved") {
    try {
      await database.query("BEGIN");

      await database.query(
        "UPDATE orders SET order_status = 'Returned' WHERE id = $1",
        [returnReq.order_id]
      );
      await database.query(
        "UPDATE payments SET payment_status = 'Refunded' WHERE order_id = $1",
        [returnReq.order_id]
      );

      const { rows: orderItems } = await database.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1",
        [returnReq.order_id]
      );
      for (const item of orderItems) {
        await database.query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [item.quantity, item.product_id]
        );
      }

      await database.query("COMMIT");
    } catch (err) {
      await database.query("ROLLBACK");
      console.error("Return approval transaction failed:", err.message);
      return next(new ErrorHandler("Failed to process return approval. Please try again.", 500));
    }
  }

  res.status(200).json({
    success: true,
    message: `Return request ${status.toLowerCase()} successfully.`,
  });
});

import SSLCommerzPayment from "sslcommerz-lts";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import database from "../database/db.js";

const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.SSLCOMMERZ_SANDBOX === "false"; // true for live, false for sandbox

export const initiatePayment = catchAsyncError(async (req, res, next) => {
  const { orderId, totalAmount, currency = "BDT" } = req.body;

  if (!orderId || !totalAmount) {
    return next(new ErrorHandler("Order ID and total amount are required", 400));
  }

  // Check if order exists and belongs to user
  const orderQuery = await database.query(
    "SELECT * FROM orders WHERE id = $1 AND buyer_id = $2",
    [orderId, req.user.id]
  );

  if (orderQuery.rowCount === 0) {
    return next(new ErrorHandler("Order not found", 404));
  }

  const order = orderQuery.rows[0];

  // Check if payment already exists
  const paymentQuery = await database.query(
    "SELECT * FROM payments WHERE order_id = $1",
    [orderId]
  );

  if (paymentQuery.rowCount > 0) {
    return next(new ErrorHandler("Payment already initiated for this order", 400));
  }

// Bug 1 FIX: `data` object referenced itself before being defined (ReferenceError crash)
  const tran_id = `tran_${orderId}_${Date.now()}`;

  const data = {
    total_amount: totalAmount,
    currency: currency,
    tran_id,
    success_url: `${process.env.BACKEND_URL}/api/v1/payment/success?tran_id=${tran_id}`,
    fail_url: `${process.env.BACKEND_URL}/api/v1/payment/fail?tran_id=${tran_id}`,
    cancel_url: `${process.env.BACKEND_URL}/api/v1/payment/cancel?tran_id=${tran_id}`,
    ipn_url: `${process.env.BACKEND_URL}/api/v1/payment/ipn`,
    shipping_method: "NO",
    product_name: "E-commerce Order",
    product_category: "General",
    product_profile: "general",
    cus_name: req.user.name,
    cus_email: req.user.email,
    cus_add1: "Dhaka", // You might want to get this from shipping info
    cus_city: "Dhaka",
    cus_state: "Dhaka",
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: req.user.phone || "01700000000",
    ship_name: req.user.name,
    ship_add1: "Dhaka",
    ship_city: "Dhaka",
    ship_state: "Dhaka",
    ship_postcode: "1000",
    ship_country: "Bangladesh",
  };

  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  const apiResponse = await sslcz.init(data);

  if (apiResponse?.GatewayPageURL) {
    // Save payment record
    await database.query(
      "INSERT INTO payments (order_id, payment_type, payment_status, payment_intent_id) VALUES ($1, $2, $3, $4)",
      [orderId, "Online", "Pending", data.tran_id]
    );

    res.status(200).json({
      success: true,
      paymentUrl: apiResponse.GatewayPageURL,
      message: "Payment initiated successfully",
    });
  } else {
    return next(new ErrorHandler("Payment initiation failed", 500));
  }
});

export const paymentSuccess = catchAsyncError(async (req, res, next) => {
  const tran_id = req.query.tran_id || req.body?.tran_id;
  const val_id = req.body?.val_id || req.query.val_id;

  if (!tran_id) {
    return res.redirect(303, `${process.env.FRONTEND_URL}/payment/fail`);
  }

  const paymentRecord = await database.query(
    "SELECT * FROM payments WHERE payment_intent_id = $1",
    [tran_id]
  );

  if (paymentRecord.rowCount === 0) {
    return res.redirect(303, `${process.env.FRONTEND_URL}/payment/fail`);
  }

  // Idempotency — already processed, skip
  if (paymentRecord.rows[0].payment_status !== "Pending") {
    return res.redirect(303, `${process.env.FRONTEND_URL}/payment/success`);
  }

  // Validate with SSLCommerz — fail safe (never fail open)
  if (!val_id) {
    return res.redirect(303, `${process.env.FRONTEND_URL}/payment/fail`);
  }

  let isValid = false;
  try {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const validationResponse = await sslcz.validate({ val_id });
    isValid = validationResponse.status === "VALID" || validationResponse.status === "VALIDATED";
  } catch (err) {
    console.error("SSLCommerz validation error:", err.message);
    isValid = false;
  }

  if (!isValid) {
    return res.redirect(303, `${process.env.FRONTEND_URL}/payment/fail`);
  }

  await database.query(
    "UPDATE payments SET payment_status = $1 WHERE payment_intent_id = $2",
    ["Paid", tran_id]
  );

  const orderResult = await database.query(
    "SELECT order_id FROM payments WHERE payment_intent_id = $1 LIMIT 1",
    [tran_id]
  );

  if (orderResult.rowCount > 0) {
    const orderId = orderResult.rows[0].order_id;

    await database.query(
      "UPDATE orders SET paid_at = CURRENT_TIMESTAMP, order_status = 'Processing' WHERE id = $1",
      [orderId]
    );

    const { rows: orderItems } = await database.query(
      "SELECT product_id, quantity FROM order_items WHERE order_id = $1",
      [orderId]
    );
    for (const item of orderItems) {
      await database.query(
        "UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }
  }

  res.redirect(303, `${process.env.FRONTEND_URL}/payment/success`);
});

export const paymentFail = catchAsyncError(async (req, res, next) => {
  const tran_id = req.query.tran_id || req.body?.tran_id;

  // Update payment status to failed
  await database.query(
    "UPDATE payments SET payment_status = $1 WHERE payment_intent_id = $2 OR order_id::text = $2",
    ["Failed", tran_id]
  );

  // Redirect to the frontend fail page
  res.redirect(`${process.env.FRONTEND_URL}/payment/fail`);
});

export const paymentCancel = catchAsyncError(async (req, res, next) => {
  const tran_id = req.query.tran_id || req.body?.tran_id;

  // Update payment status to Cancelled (distinct from Failed)
  await database.query(
    "UPDATE payments SET payment_status = $1 WHERE payment_intent_id = $2 OR order_id::text = $2",
    ["Cancelled", tran_id]
  );

  // Redirect to the frontend cancel page
  res.redirect(`${process.env.FRONTEND_URL}/payment/cancel`);
});

export const paymentIPN = catchAsyncError(async (req, res, next) => {
  // Handle Instant Payment Notification
  const tran_id = req.query.tran_id || req.body?.tran_id;
  const val_id = req.body?.val_id || req.query.val_id;
  const status = req.body?.status;

  if (status === "VALID") {
    await database.query(
      "UPDATE payments SET payment_status = $1 WHERE payment_intent_id = $2 OR order_id::text = $2",
      ["Paid", tran_id]
    );

    await database.query(
      "UPDATE orders SET order_status = $1, paid_at = CURRENT_TIMESTAMP WHERE id::text = $2 OR id = (SELECT order_id FROM payments WHERE payment_intent_id = $2 LIMIT 1)",
      ["Processing", tran_id]
    );
  }

  res.status(200).send("IPN received");
});
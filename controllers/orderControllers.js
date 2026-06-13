import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import database from "../database/db.js";
import { generatePaymentUrl } from "../utils/generatePaymentIntent.js";

// User can place a new order
export const placeNewOrder = catchAsyncError(async (req, res, next) => {
  const {
    full_name,
    state,
    city,
    address,
    zip_code,
    phone_number,
    ordered_Items,
    payment_method, // "Online" | "COD"
  } = req.body;

  if (!full_name || !state || !city || !address || !zip_code || !phone_number) {
    return next(new ErrorHandler("Please fill all the fields", 400));
  }

  const item = Array.isArray(ordered_Items)
    ? ordered_Items
    : JSON.parse(ordered_Items);

  if (!item || item.length === 0) {
    return next(new ErrorHandler("No items to order", 400));
  }

  const isCOD = payment_method === "COD";

  const productIds = item.map((item) => item.product.id);

  const { rows: products } = await database.query(
    "SELECT id, price, discount_price, stock, name FROM products WHERE id = ANY($1)",
    [productIds],
  );

  let totalAmount = 0;
  let tax_price = 0;

  for (const cartItem of item) {
    const product = products.find((p) => p.id === cartItem.product.id);
    if (!product) {
      return next(new ErrorHandler(`Product with ID ${cartItem.product.id} not found`, 404));
    }
    if (cartItem.quantity > product.stock) {
      return next(new ErrorHandler(`Only ${product.stock} units of ${product.name} available`, 400));
    }
    const effectivePrice = product.discount_price > 0 && product.discount_price < product.price
      ? product.discount_price
      : product.price;
    totalAmount += effectivePrice * cartItem.quantity;
  }

  const shipping_price = totalAmount > 5000 ? 0 : 100;
  tax_price = Math.round(totalAmount * 0.05);
  const total_price = Math.round(totalAmount + tax_price + shipping_price);

  const orderResult = await database.query(
    "INSERT INTO orders (buyer_id, total_price, tax_price, shipping_price, order_status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [req.user.id, total_price, tax_price, shipping_price, "Processing"],
  );

  const orderId = orderResult.rows[0].id;

  for (let i = 0; i < item.length; i++) {
    const itemData = item[i];
    const product = products.find((p) => p.id === itemData.product.id);
    const effectivePrice = product.discount_price > 0 && product.discount_price < product.price
      ? product.discount_price
      : product.price;

    await database.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price, image, title, size) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        orderId,
        product.id,
        itemData.quantity,
        effectivePrice,
        itemData.product.images?.[0]?.url || "",
        product.name,
        itemData.product.selectedSize || null,
      ],
    );
  }

  await database.query(
    `INSERT INTO shipping_info (order_id, full_name, state, city, address, pincode, phone, country) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [orderId, full_name, state, city, address, zip_code, phone_number, "Bangladesh"],
  );

  // ── COD: record payment as Pending, skip SSLCommerz ──
  if (isCOD) {
    await database.query(
      "INSERT INTO payments (order_id, payment_type, payment_status, payment_intent_id) VALUES ($1, $2, $3, $4)",
      [orderId, "Cash On Delivery", "Pending", `cod_${orderId}`]
    );

    return res.status(201).json({
      success: true,
      message: "Order placed successfully. Pay on delivery.",
      paymentMethod: "COD",
      orderId,
      total_price,
    });
  }

  // ── Online: initiate SSLCommerz ──
  const paymentResponse = await generatePaymentUrl(
    orderId,
    total_price,
    "BDT",
    req.user,
  );

  if (!paymentResponse.success) {
    return next(
      new ErrorHandler(
        paymentResponse.message || "Failed to create payment intent, try again later",
        500,
      ),
    );
  }

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    paymentMethod: "Online",
    paymentUrl: paymentResponse.url,
    total_price,
  });
});

// Bug 22 FIX: IDOR — add ownership check so users can only fetch their own orders
export const fetchSingleOrder = catchAsyncError(async (req, res, next) => {
  const { orderId } = req.params;
  const result = await database.query(
    `SELECT 
    o.*, 
    COALESCE(
        json_agg(
            json_build_object(
                'order_item_id', oi.id,
                'order_id', oi.order_id,
                'product_id', oi.product_id,
                'quantity', oi.quantity,
                'price', oi.price
            )
        ) FILTER (WHERE oi.id IS NOT NULL), '[]'
    ) AS order_items,
    json_build_object(
        'full_name', s.full_name,
        'state', s.state,
        'city', s.city,
        'country', s.country,
        'address', s.address,
        'pincode', s.pincode,
        'phone', s.phone
    ) AS shipping_info
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN shipping_info s ON o.id = s.order_id
WHERE o.id = $1 AND o.buyer_id = $2
GROUP BY o.id, s.id;`,
    [orderId, req.user.id],
  );

  if (!result.rows[0]) {
    return next(new ErrorHandler("Order not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Order fetched successfully",
    order: result.rows[0],
  });
});


// Bug 21 FIX: missing 'state' in shipping_info JSON for fetchMyOrders
export const fetchMyOrders = catchAsyncError(async (req, res, next) => {
  const result = await database.query(
    `SELECT o.*, COALESCE(
    json_agg(
      json_build_object(
          'order_item_id', oi.id,
                'order_id', oi.order_id,
                'product_id', oi.product_id,
                'quantity', oi.quantity,
                'price', oi.price,
                'image', oi.image,
                'title', oi.title,
                'size', oi.size
      ) 
    ) FILTER (WHERE oi.id IS NOT NULL), '[]'
    ) AS order_items,
       json_build_object(
        'full_name', s.full_name,
        'state', s.state,
        'city', s.city,
        'country', s.country,
        'address', s.address,
        'pincode', s.pincode,
        'phone', s.phone
    ) AS shipping_info 
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN shipping_info s ON o.id = s.order_id
WHERE o.buyer_id = $1
GROUP BY o.id, s.id
    `,
    [req.user.id],
  );

  res.status(200).json({
    success: true,
    message: "All orders fetched successfully",
    orders: result.rows,
  });
});


// Admin can fetch all orders
export const fetchAllOrders = catchAsyncError(async (req, res, next) => {
  const result = await database.query(`
    SELECT o.*,
    COALESCE(json_agg(
      json_build_object(
        'order_item_id', oi.id,
                'order_id', oi.order_id,
                'product_id', oi.product_id,
                'quantity', oi.quantity,
                'price', oi.price,
                'image', oi.image,
                'title', oi.title,
                'size', oi.size
      )
    ) FILTER (WHERE oi.id IS NOT NULL), '[]' ) AS order_items,
    json_build_object(
      'full_name', s.full_name,
      'state', s.state,
      'city', s.city,
      'country', s.country,
      'address', s.address,
      'pincode', s.pincode,
      'phone', s.phone
    ) AS shipping_info,
    p.payment_status,
    p.payment_intent_id
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN shipping_info s ON o.id = s.order_id
    LEFT JOIN payments p ON o.id = p.order_id
    GROUP BY o.id, s.id, p.payment_status, p.payment_intent_id
    ORDER BY o.created_at DESC
    `);

  res.status(200).json({
    success: true,
    message: "All orders fetched",
    orders: result.rows,
  });
});


// Admin can update order status
export const updateOrderStatus = catchAsyncError(async (req, res, next) => {
  const { status } = req.body;
  if (!status) {
    return next(new ErrorHandler("Please provide a valid status", 400));
  }
  const { orderId } = req.params;
  const result = await database.query("SELECT * FROM orders WHERE id = $1", [orderId]);

  if (result.rows.length === 0) {
    return next(new ErrorHandler("Order not found", 404));
  }

  const previousStatus = result.rows[0].order_status;

  const updatedOrder = await database.query(
    "UPDATE orders SET order_status = $1 WHERE id = $2 RETURNING *",
    [status, orderId]
  );

  // Restore stock and mark payment as Refunded when order is Cancelled
  if (status === "Cancelled" && previousStatus !== "Cancelled") {
    const isPaid = await database.query(
      "SELECT payment_status, payment_type FROM payments WHERE order_id = $1 LIMIT 1",
      [orderId]
    );
    const payment = isPaid.rows[0];

    // For online payments: restore stock + refund only if already paid
    // For COD: stock was never deducted, payment was never taken — just mark Cancelled
    if (payment?.payment_status === "Paid" && payment?.payment_type !== "Cash On Delivery") {
      // Restore stock
      const { rows: orderItems } = await database.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = $1",
        [orderId]
      );
      for (const item of orderItems) {
        await database.query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [item.quantity, item.product_id]
        );
      }
      // Mark payment as Refunded
      await database.query(
        "UPDATE payments SET payment_status = 'Refunded' WHERE order_id = $1",
        [orderId]
      );
    } else if (payment?.payment_type === "Cash On Delivery" && payment?.payment_status === "Pending") {
      // COD not yet paid — just mark as Cancelled
      await database.query(
        "UPDATE payments SET payment_status = 'Cancelled' WHERE order_id = $1",
        [orderId]
      );
    }
  }

  // COD: when admin marks as Delivered → mark payment as Paid + deduct stock + set paid_at
  if (status === "Delivered" && previousStatus !== "Delivered") {
    const paymentInfo = await database.query(
      "SELECT payment_type, payment_status FROM payments WHERE order_id = $1 LIMIT 1",
      [orderId]
    );
    const payment = paymentInfo.rows[0];

    if (payment?.payment_type === "Cash On Delivery" && payment?.payment_status === "Pending") {
      // Mark as paid
      await database.query(
        "UPDATE payments SET payment_status = $1 WHERE order_id = $2",
        ["Paid", orderId]
      );
      // Set paid_at on the order
      await database.query(
        "UPDATE orders SET paid_at = CURRENT_TIMESTAMP WHERE id = $1",
        [orderId]
      );
      // Deduct stock now (COD stock is deducted at delivery, not at order placement)
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
  }

  res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    order: updatedOrder.rows[0],
  });
});


// Admin can delete an order
export const deleteOrder = catchAsyncError(async (req, res, next) => {
  const { orderId } = req.params;
  const result = await database.query(
    "DELETE FROM orders WHERE id = $1 RETURNING *",
    [orderId],
  );

  if (result.rows.length === 0) {
    return next(new ErrorHandler("Order not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Order deleted successfully",
    order: result.rows[0],
  });
});


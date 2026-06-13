import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import database from "../database/db.js";
import { v2 as cloudinary } from "cloudinary";

export const getAllUsers = catchAsyncError(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const totalUsersResult = await database.query(
    "SELECT COUNT(*) FROM users WHERE role = $1",
    ["User"],
  );
  const totalUsers = parseInt(totalUsersResult.rows[0].count);

  const offset = (page - 1) * 10;

  const users = await database.query(
    "SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    ["User", 10, offset],
  );
  res.status(200).json({
    success: true,
    users: users.rows,
    currentPage: page,
    totalUsers,
  });
});

export const deleteUser = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const deletedUser = await database.query(
    "DELETE FROM users WHERE id = $1 RETURNING *",
    [id],
  );
  if (deletedUser.rowCount === 0) {
    return next(new ErrorHandler("User not found", 404));
  }

  const avatar = deletedUser.rows[0].avatar;
  if (avatar ? avatar.public_id : null) {
    // Call Cloudinary API to delete the image
    await cloudinary.uploader.destroy(avatar.public_id);
  }
  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

export const dashboardStats = catchAsyncError(async (req, res, next) => {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localToday = new Date(today.getTime() - (offset * 60 * 1000));
  const todayDate = localToday.toISOString().split("T")[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const localYesterday = new Date(yesterday.getTime() - (offset * 60 * 1000));
  const yesterdayDate = localYesterday.toISOString().split("T")[0];

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  );
  const previousMonthStart = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  );
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const totalRevenueResult = await database.query(
    `SELECT SUM(o.total_price) AS total_revenue 
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'`,
  );
  const totalRevenue = parseFloat(
    totalRevenueResult.rows[0].total_revenue || 0,
  );

  //total users
  const totalUserCountQuery = await database.query(
    "SELECT COUNT(*) FROM users WHERE role = $1",
    ["User"],
  );
  const totalUsersCount = parseInt(totalUserCountQuery.rows[0].count) || 0;

  //order stats count

  const orderStatsCountQuery = await database.query(
    "SELECT order_status, COUNT(*) AS count FROM orders GROUP BY order_status",
  );
  const orderStatsCount = {
    Processing: 0,
    Shipped: 0,
    Delivered: 0,
    Cancelled: 0,
    Returned: 0,
  };
  orderStatsCountQuery.rows.forEach((row) => {
    orderStatsCount[row.order_status] = parseInt(row.count);
  });

  //todays revenue
  const todayRevenueQuery = await database.query(
    `SELECT SUM(o.total_price) AS today_revenue 
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'
     AND DATE(o.created_at) = $1`,
    [todayDate],
  );
  const todayRevenue = parseFloat(todayRevenueQuery.rows[0].today_revenue || 0);

  //yesterday revenue
  const yesterdayRevenueQuery = await database.query(
    `SELECT SUM(o.total_price) AS yesterday_revenue 
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'
     AND DATE(o.created_at) = $1`,
    [yesterdayDate],
  );
  const yesterdayRevenue = parseFloat(
    yesterdayRevenueQuery.rows[0].yesterday_revenue || 0,
  );

  //Monthly sales in line chart
  const monthlySalesQuery = await database.query(
    `SELECT TO_CHAR(o.created_at, 'Mon YYYY') AS month, 
            DATE_TRUNC('month', o.created_at) AS month_start, 
            SUM(o.total_price) AS total_sales 
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'
     GROUP BY month, month_start 
     ORDER BY month_start ASC`,
  );

  const monthlySales = monthlySalesQuery.rows.map((row) => ({
    month: row.month,
    total_sales: parseFloat(row.total_sales) || 0,
  }));

  //Top selling products
  const topSellingProductsQuery = await database.query(
    `SELECT p.id, p.name, p.images->0->>'url' AS image_url, p.category, p.ratings,
            SUM(oi.quantity) AS total_sold
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN orders o ON oi.order_id = o.id
     JOIN payments pay ON pay.order_id = o.id
     WHERE pay.payment_status = 'Paid'
     AND o.order_status NOT IN ('Cancelled', 'Returned')
     GROUP BY p.id, p.images->0->>'url', p.category, p.ratings
     ORDER BY total_sold DESC LIMIT 5`,
  );
  const topSellingProducts = topSellingProductsQuery.rows;

  //Total sales of current month
  const currentMonthSalesQuery = await database.query(
    `SELECT SUM(o.total_price) AS current_month_sales 
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'
     AND o.created_at BETWEEN $1 AND $2`,
    [currentMonthStart, currentMonthEnd],
  );
  const currentMonthSales = parseFloat(
    currentMonthSalesQuery.rows[0].current_month_sales || 0,
  );

  //Products with low stock
  const lowStockProductsQuery = await database.query(
    "SELECT id, name, stock FROM products WHERE stock <= 5 ORDER BY stock ASC",
  );
  const lowStockProducts = lowStockProductsQuery.rows;

  //Revenue Growth Rate
  const previousMonthRevenueQuery = await database.query(
    `SELECT SUM(o.total_price) AS previous_month_revenue 
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'
     AND o.created_at BETWEEN $1 AND $2`,
    [previousMonthStart, previousMonthEnd],
  );
  const previousMonthRevenue = parseFloat(
    previousMonthRevenueQuery.rows[0].previous_month_revenue || 0,
  );

  let revenueGrowthRate = "0%";
  if (previousMonthRevenue > 0) {
    const growthRate =
      ((currentMonthSales - previousMonthRevenue) / previousMonthRevenue) * 100;
    revenueGrowthRate = `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(2)}%`;
  }

  //New Users this month
  const newUsersThisMonthQuery = await database.query(
    `SELECT COUNT(*) AS new_users FROM users WHERE created_at >= $1 AND role = 'User'`,
    [currentMonthStart],
  );
  const newUsersThisMonth =
    parseInt(newUsersThisMonthQuery.rows[0].new_users) || 0;

  // Newsletter subscribers count
  const newsletterCountQuery = await database.query(
    "SELECT COUNT(*) AS total FROM newsletter_subscribers"
  );
  const newsletterSubscribers = parseInt(newsletterCountQuery.rows[0].total) || 0;

  //Final response
  res.status(200).json({
    success: true,
    message: "Dashboard stats fetched successfully",
    totalRevenue,
    totalUsersCount,
    orderStatsCount,
    todayRevenue,
    yesterdayRevenue,
    monthlySales,
    topSellingProducts,
    currentMonthSales,
    lowStockProducts,
    revenueGrowthRate,
    newUsersThisMonth,
    newsletterSubscribers,
  });
});

export const generateReport = catchAsyncError(async (req, res, next) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return next(new ErrorHandler("Please provide 'from' and 'to' date parameters", 400));
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999); // include full last day

  if (isNaN(fromDate) || isNaN(toDate)) {
    return next(new ErrorHandler("Invalid date format", 400));
  }

  if (fromDate > toDate) {
    return next(new ErrorHandler("'from' date must be before 'to' date", 400));
  }

  // Total revenue in range (paid only)
  const revenueResult = await database.query(
    `SELECT COALESCE(SUM(o.total_price), 0) AS total_revenue
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'
     AND o.created_at BETWEEN $1 AND $2`,
    [fromDate, toDate]
  );
  const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue);

  // Total orders in range
  const ordersCountResult = await database.query(
    `SELECT COUNT(*) AS total_orders FROM orders WHERE created_at BETWEEN $1 AND $2`,
    [fromDate, toDate]
  );
  const totalOrders = parseInt(ordersCountResult.rows[0].total_orders);

  // Order status breakdown in range
  const statusResult = await database.query(
    `SELECT order_status, COUNT(*) AS count FROM orders
     WHERE created_at BETWEEN $1 AND $2
     GROUP BY order_status`,
    [fromDate, toDate]
  );
  const orderStatusBreakdown = { Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0, Returned: 0 };
  statusResult.rows.forEach(r => { orderStatusBreakdown[r.order_status] = parseInt(r.count); });

  // New users in range
  const usersResult = await database.query(
    `SELECT COUNT(*) AS new_users FROM users WHERE role = 'User' AND created_at BETWEEN $1 AND $2`,
    [fromDate, toDate]
  );
  const newUsers = parseInt(usersResult.rows[0].new_users);

  // Daily sales breakdown in range
  const dailySalesResult = await database.query(
    `SELECT DATE(o.created_at) AS day, COALESCE(SUM(o.total_price), 0) AS daily_revenue
     FROM orders o
     JOIN payments p ON p.order_id = o.id
     WHERE p.payment_status = 'Paid'
     AND o.created_at BETWEEN $1 AND $2
     GROUP BY day ORDER BY day ASC`,
    [fromDate, toDate]
  );
  const dailySales = dailySalesResult.rows.map(r => ({
    day: new Date(r.day).toLocaleDateString("en-BD", { year: "numeric", month: "short", day: "numeric" }),
    revenue: parseFloat(r.daily_revenue),
  }));

  // Top selling products in range (exclude cancelled and returned orders)
  const topProductsResult = await database.query(
    `SELECT p.name, p.category, SUM(oi.quantity) AS total_sold,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS total_revenue
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN orders o ON oi.order_id = o.id
     JOIN payments pay ON pay.order_id = o.id
     WHERE pay.payment_status = 'Paid'
     AND o.order_status NOT IN ('Cancelled', 'Returned')
     AND o.created_at BETWEEN $1 AND $2
     GROUP BY p.id, p.name, p.category
     ORDER BY total_sold DESC LIMIT 10`,
    [fromDate, toDate]
  );

  // Return requests in range
  const returnResult = await database.query(
    `SELECT
       COUNT(*) AS total_returns,
       COUNT(*) FILTER (WHERE status = 'Pending') AS pending_returns,
       COUNT(*) FILTER (WHERE status = 'Approved') AS approved_returns,
       COUNT(*) FILTER (WHERE status = 'Rejected') AS rejected_returns
     FROM return_requests
     WHERE created_at BETWEEN $1 AND $2`,
    [fromDate, toDate]
  );
  const returnStats = {
    total: parseInt(returnResult.rows[0].total_returns) || 0,
    pending: parseInt(returnResult.rows[0].pending_returns) || 0,
    approved: parseInt(returnResult.rows[0].approved_returns) || 0,
    rejected: parseInt(returnResult.rows[0].rejected_returns) || 0,
  };

  res.status(200).json({
    success: true,
    from: fromDate.toISOString().split("T")[0],
    to: toDate.toISOString().split("T")[0],
    totalRevenue,
    totalOrders,
    newUsers,
    orderStatusBreakdown,
    dailySales,
    topProducts: topProductsResult.rows,
    returnStats,
  });
});

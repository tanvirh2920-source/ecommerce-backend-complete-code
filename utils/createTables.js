import { createUserTable } from "../models/userTable.js";
import { createShippingInfoTable } from "../models/shippinginfoTable.js";
import { createProductsTable } from "../models/productTable.js";
import { createProductReviewsTable } from "../models/productReviewsTable.js";
import { createPaymentsTable } from "../models/paymentsTable.js";
import { createOrdersTable } from "../models/ordersTable.js";
import { createOrderItemTable } from "../models/orderItemsTable.js";
import { createReturnRequestsTable } from "../models/returnRequestsTable.js";
import { createContactMessagesTable } from "../models/contactMessagesTable.js";

export const createTables = async () => {
    try {
        await createUserTable();
        await createProductsTable();
        await createProductReviewsTable();
        await createOrdersTable();
        await createOrderItemTable();
        await createShippingInfoTable();
        await createPaymentsTable();
        await createReturnRequestsTable();
        await createContactMessagesTable();
        console.log("✅ All tables created successfully.");
    } catch (error) {
        console.error("❌ Failed To Create Tables.", error);
    }
};
import database from "../database/db.js";
import SSLCommerzPayment from "sslcommerz-lts";
import dotenv from "dotenv";

dotenv.config();

export const generatePaymentUrl = async (orderId, totalAmount, currency, user) => {
    try {
        const store_id = process.env.SSLCOMMERZ_STORE_ID;
        const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
        const is_live = process.env.SSLCOMMERZ_SANDBOX === "false";

        if (!store_id || !store_passwd) {
            return { success: false, message: "Payment service not configured" };
        }

        const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";

        // Use a unique tran_id (not orderId) so we can look it up reliably
        const tran_id = `tran_${orderId}_${Date.now()}`;

        const data = {
            total_amount: totalAmount,
            currency: currency || "BDT",
            tran_id,
            success_url: `${backendUrl}/api/v1/payment/success?tran_id=${tran_id}`,
            fail_url: `${backendUrl}/api/v1/payment/fail?tran_id=${tran_id}`,
            cancel_url: `${backendUrl}/api/v1/payment/cancel?tran_id=${tran_id}`,
            ipn_url: `${backendUrl}/api/v1/payment/ipn`,
            shipping_method: 'Courier',
            product_name: 'Nittodin Products',
            product_category: 'General',
            product_profile: 'general',
            cus_name: user?.name || 'Customer',
            cus_email: user?.email || 'customer@example.com',
            cus_add1: 'Dhaka',
            cus_city: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: user?.phone || '01700000000',
            ship_name: user?.name || 'Customer',
            ship_add1: 'Dhaka',
            ship_city: 'Dhaka',
            ship_postcode: 1000,
            ship_country: 'Bangladesh',
        };

        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const apiResponse = await sslcz.init(data);

        if (apiResponse?.GatewayPageURL) {
            try {
                // Store tran_id as payment_intent_id so paymentSuccess can find it
                await database.query(
                    "INSERT INTO payments (order_id, payment_type, payment_intent_id, payment_status) VALUES ($1, $2, $3, $4)",
                    [orderId, "Online", tran_id, "Pending"]
                );
            } catch (dbError) {
                console.error("Database error saving payment record:", dbError);
                return { success: false, message: "Failed to save payment record" };
            }

            return { success: true, url: apiResponse.GatewayPageURL };
        } else {
            return { success: false, message: "Failed to generate SSLCommerz gateway URL" };
        }

    } catch (error) {
        console.error("Error initializing SSLCommerz payment:", error);
        return { success: false, message: "Server error during payment initialization" };
    }
};

/**
 * Generates an HTML email template for discount notifications sent to newsletter subscribers.
 * @param {Object} product - The product object with name, price, discount_price, category, images
 * @param {string} frontendUrl - The base URL of the frontend store
 */
export const generateDiscountEmailTemplate = (product, frontendUrl) => {
  const discountAmount = Number(product.price) - Number(product.discount_price);
  const discountPercent = Math.round((discountAmount / Number(product.price)) * 100);
  const imageUrl = product.images?.[0]?.url || "";
  const productUrl = `${frontendUrl}/products/${product.id}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Special Discount — Daily Bazar</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:0;mso-hide:all;">
    🎉 ${discountPercent}% OFF on ${product.name} — Limited time offer!
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#9333ea);padding:32px 30px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.75);">Daily Bazar</p>
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">
                🎉 Special Offer Just for You!
              </h1>
              <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.85);">
                One of our products just got a great discount.
              </p>
            </td>
          </tr>

          <!-- Discount Badge -->
          <tr>
            <td style="padding:0;text-align:center;background-color:#faf5ff;">
              <div style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-size:18px;font-weight:800;padding:10px 28px;border-radius:0 0 20px 20px;letter-spacing:1px;">
                ${discountPercent}% OFF
              </div>
            </td>
          </tr>

          <!-- Product Card -->
          <tr>
            <td style="padding:32px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9f5ff;border-radius:12px;overflow:hidden;border:1px solid #ede9fe;">
                ${imageUrl ? `
                <tr>
                  <td style="padding:0;text-align:center;background:#fff;">
                    <img src="${imageUrl}" alt="${product.name}" width="100%" style="max-height:280px;object-fit:cover;display:block;border-radius:12px 12px 0 0;" />
                  </td>
                </tr>` : ""}
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;">${product.category}</p>
                    <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#1a1a2e;line-height:1.3;">${product.name}</h2>

                    <!-- Price Row -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding-right:16px;">
                          <p style="margin:0;font-size:13px;color:#9ca3af;text-decoration:line-through;">৳ ${Number(product.price).toLocaleString()}</p>
                          <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#7c3aed;">৳ ${Number(product.discount_price).toLocaleString()}</p>
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:6px 12px;text-align:center;">
                            <p style="margin:0;font-size:12px;font-weight:700;color:#92400e;">You save</p>
                            <p style="margin:2px 0 0;font-size:16px;font-weight:800;color:#b45309;">৳ ${discountAmount.toLocaleString()}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 30px 36px;text-align:center;">
              <a href="${productUrl}" target="_blank" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;box-shadow:0 4px 15px rgba(124,58,237,0.4);">
                Shop Now →
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">Hurry! This offer may not last long.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 30px;background-color:#f9fafb;border-top:1px solid #eeeeee;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">
                You're receiving this because you subscribed to <strong>Daily Bazar</strong> newsletter.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © 2025 Daily Bazar. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

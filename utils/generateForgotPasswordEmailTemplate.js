export const generateEmailTemplate = (resetPasswordUrl, userName) => {
  const storeName = "E-Commerce Store";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - ${storeName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f7; color: #333333;">
  
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 0px; mso-hide: all;">
    Action required: Reset your password for ${storeName}.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; font-size: 24px; color: #111111; text-align: left;">Reset Your Password</h2>
              
              <p style="margin: 0 0 15px; font-size: 16px; line-height: 1.5; color: #555555;">Hello ${userName},</p>
              
              <p style="margin: 0 0 25px; font-size: 16px; line-height: 1.5; color: #555555;">
                We received a request to reset the password for your account. If you made this request, please click the button below to choose a new password:
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #000000;">
                    <a href="${resetPasswordUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; border: 1px solid #000000;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 15px; font-size: 14px; line-height: 1.5; color: #777777;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged. This link will expire in 15 minutes.
              </p>

              <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eeeeee; word-break: break-all;">
                <p style="margin: 0 0 10px; font-size: 13px; color: #777777;">If the button doesn't work, paste this link into your browser:</p>
                <a href="${resetPasswordUrl}" style="font-size: 13px; color: #0056b3; text-decoration: underline;">${resetPasswordUrl}</a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 30px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #888888;">
                Thank you,<br>The ${storeName} Team
              </p>
              <p style="margin: 0; font-size: 12px; color: #aaaaaa;">
                This is an automated message. Please do not reply directly to this email.
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

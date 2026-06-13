import nodeMailer from "nodemailer";

export const sendEmail = async ({ email, subject, message }) => {
    try {
        const smtpService = (process.env.SMTP_SERVICE || "gmail").trim();
        const smtpHost = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
        const smtpPort = Number(process.env.SMTP_PORT || 465);
        const smtpMail = (process.env.SMTP_MAIL || "").trim();
        const smtpPassword = String(process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");

        if (!smtpMail || !smtpPassword) {
            throw new Error("SMTP_MAIL and SMTP_PASSWORD must be set in environment variables.");
        }

        const transporter = nodeMailer.createTransport({
            service: smtpService,
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: smtpMail,
                pass: smtpPassword,
            },
        });

        const mailOptions = {
            from: smtpMail,
            to: email,
            subject,
            html: message,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", result.messageId);
        return result;
    } catch (error) {
        console.error("Email sending failed:", error.message);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};

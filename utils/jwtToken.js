import jwt from "jsonwebtoken";

export const sendToken = (user,statusCode, message, res) => {
    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET_KEY, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });

// Bug 4 FIX: JWT token exposed in response body — security risk, remove it
    res.status(statusCode).cookie("token", token, {
        expires: new Date(Date.now() + process.env.COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
    }).json({
        success: true,
        user,
        message,
    });
        
};

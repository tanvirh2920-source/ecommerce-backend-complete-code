import jwt from "jsonwebtoken";
import { catchAsyncError } from "./catchAsyncError.js";
import ErrorHandler from "./errorMiddlewares.js";
import database from "../database/db.js";


// jwt.verify throws synchronously — wrap in try/catch
export const isAuthenticated = catchAsyncError(async (req,res,next) => {
    const {token} = req.cookies;
    if(!token){
        return next(new ErrorHandler("Please login to access this resource",401));
    }
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch {
        return next(new ErrorHandler("Invalid or expired token, please login again",401));
    }
    const user = await database.query(
        "SELECT id, name, email, role, phone, avatar, created_at FROM users WHERE id = $1",
        [decoded.id]
    );
    if (!user.rows[0]) {
        return next(new ErrorHandler("User not found", 401));
    }
    req.user = user.rows[0];
    next();
});

export const authorizeRoles = (...roles) => {
    return (req,res,next) => {
        if(!roles.includes(req.user.role)){
            return next(new ErrorHandler(`Role: ${req.user.role} is not allowed to access this resource`,403));
        }
        next();
    };
};

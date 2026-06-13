import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config({ path: ".env", override: false });

const cloudName = process.env.CLOUDINARY_CLIENT_NAME || process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_CLIENT_API || process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_CLIENT_SECRET || process.env.CLOUDINARY_API_SECRET;
const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  console.log("Cloudinary config loaded:", {
    cloud_name: cloudName,
    api_key: !!apiKey,
    api_secret: !!apiSecret,
    cloudinary_url: !!cloudinaryUrl,
  });
} else {
  console.warn("Cloudinary config not fully set. Image upload may fail until CLOUDINARY_CLIENT_NAME, CLOUDINARY_CLIENT_API, and CLOUDINARY_CLIENT_SECRET are provided.");
}

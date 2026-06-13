import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { v2 as cloudinary } from "cloudinary";
import database from "../database/db.js";
import getAIRecommendations from "../utils/getAIRecommendation.js";
import { sendEmail } from "../utils/sendemail.js";
import { generateDiscountEmailTemplate } from "../utils/generateDiscountEmailTemplate.js";

// Helper: send discount notification to all subscribers (fire-and-forget)
const notifySubscribersAboutDiscount = async (product) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const subscribersResult = await database.query(
      "SELECT email FROM newsletter_subscribers"
    );
    const subscribers = subscribersResult.rows;
    if (subscribers.length === 0) return;

    const htmlMessage = generateDiscountEmailTemplate(product, frontendUrl);
    const discountPercent = Math.round(
      ((Number(product.price) - Number(product.discount_price)) / Number(product.price)) * 100
    );

    // Send emails concurrently (no await — fire and forget so it doesn't slow the API response)
    Promise.allSettled(
      subscribers.map((sub) =>
        sendEmail({
          email: sub.email,
          subject: `🎉 ${discountPercent}% OFF on "${product.name}" — Daily Bazar`,
          message: htmlMessage,
        })
      )
    ).then((results) => {
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) console.warn(`⚠️ ${failed} discount notification email(s) failed to send.`);
      else console.log(`✅ Discount notification sent to ${subscribers.length} subscriber(s).`);
    });
  } catch (err) {
    console.error("❌ Failed to send discount notifications:", err.message);
  }
};


// Create Product - Admin Only
export const createProduct = catchAsyncError(async (req, res, next) => {
  const { name, description, price, discount_price, category, stock, sizes } = req.body;
  const created_by = req.user.id;

   if (!name || !description || !price || !category || !stock) {
    return next(new ErrorHandler("Please provide complete product information.", 400));
  }

  // Parse sizes — only relevant for Fashion category
  let parsedSizes = [];
  if (sizes) {
    try {
      parsedSizes = typeof sizes === "string" ? JSON.parse(sizes) : sizes;
    } catch (_) {
      parsedSizes = [];
    }
  }

  let uploadedImages = [];
  const files = [];

  if (req.files?.images) files.push(req.files.images);
  if (req.files?.image) files.push(req.files.image);

  if (files.length > 0) {
    const images = files.flatMap((file) =>
      Array.isArray(file) ? file : [file],
    );

    for (const image of images) {
      try {
        const result = await cloudinary.uploader.upload(image.tempFilePath, {
          folder: "Ecommerce_Products_Images",
          width: 1000,
          crop: "scale",
          resource_type: "image",
        });

        uploadedImages.push({
          url: result.secure_url,
          public_id: result.public_id,
        });
      } catch (error) {
        const errorCode = error.http_code || error.code || "unknown";
        const errorName = error.name || "CloudinaryError";
        return next(
          new ErrorHandler(
            `Image upload failed: ${errorName} (${errorCode}) ${error.message || "Cloudinary error"}`,
            500,
          ),
        );
      }
    }
  }

  const product = await database.query(
    `INSERT INTO products (name, description, price, discount_price, category, stock, created_by, images, sizes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
    [
      name,
      description,
      price,
      discount_price || 0,
      category,
      stock,
      created_by,
      JSON.stringify(uploadedImages),
      JSON.stringify(parsedSizes),
    ],
  );

  const createdProduct = product.rows[0];

  // Notify subscribers if this product has a discount
  if (Number(discount_price) > 0) {
    notifySubscribersAboutDiscount({
      ...createdProduct,
      images: uploadedImages,
    });
  }

  res.status(201).json({
    success: true,
    message: "Product created successfully.",
    product: {
      ...createdProduct,
      images: uploadedImages,
    },
  });
});


// Fetch All Products with Filters, Pagination, New Products, and Top Rated Products
export const fetchAllProducts = catchAsyncError(async (req, res, next) => {
  const { availability, price, category, ratings, search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const conditions = [];
  const values = [];

  let index = 1;
  let paginationPlaceholders = {};

  // Apply filters based on availability
  if (availability === "in-stock") {
    conditions.push("stock > 5");
  } else if (availability === "limited-stock") {
    conditions.push("stock > 0 AND stock <= 5");
  } else if (availability === "out-of-stock") {
    conditions.push("stock = 0");
  }
  // Apply price range filter
  if (price) {
    const [minPrice, maxPrice] = price.split("-");
    if (minPrice && maxPrice) {
      conditions.push(`price BETWEEN $${index} AND $${index + 1}`);
      values.push(minPrice, maxPrice);
      index += 2;
    }
  }

  // Apply category filter
  if (category) {
    conditions.push(`category ILIKE $${index}`);
    values.push(`%${category}%`);
    index++;
  }

  // Apply ratings filter
  if (ratings) {
    conditions.push(`ratings >= $${index}`);
    values.push(ratings);
    index++;
  }
  // Apply search filter
  if (search) {
    conditions.push(
      `(p.name ILIKE $${index} OR p.description ILIKE $${index + 1})`,
    );
    values.push(`%${search}%`, `%${search}%`);
    index += 2;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  //Get count of total products for pagination
  const totalProductsResult = await database.query(
    `SELECT COUNT(*) FROM products p ${whereClause}`,
    values,
  );
  const totalProducts = parseInt(totalProductsResult.rows[0].count);
  paginationPlaceholders.limit = `$${index}`;
  values.push(limit);
  index++;

  paginationPlaceholders.offset = `$${index}`;
  values.push(offset);
  index++;

  // Fetch With Reviews
  const query = `
        SELECT p.*, COUNT(r.id) AS review_count FROM products p
        LEFT JOIN reviews r ON p.id = r.product_id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ${paginationPlaceholders.limit} OFFSET ${paginationPlaceholders.offset}
    `;

  const result = await database.query(query, values);

  // Fetch New Products
  const newProductsQuery = `SELECT p.*, COUNT(r.id) AS review_count FROM products p
    LEFT JOIN reviews r ON p.id = r.product_id
    WHERE p.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 8`;

  const newProductsResult = await database.query(newProductsQuery);

  // Query For Fetching Top Rated Products (ratings >= 4.5)
  const topRatedQuery = `SELECT p.*, COUNT(r.id) AS review_count FROM products p
    LEFT JOIN reviews r ON p.id = r.product_id
    WHERE p.ratings >= 4.5
    GROUP BY p.id
    ORDER BY p.ratings DESC, p.created_at DESC
    LIMIT 8`;

  const topRatedResult = await database.query(topRatedQuery);

  res.status(200).json({
    success: true,
    products: result.rows,
    newProducts: newProductsResult.rows,
    totalProducts,
    topRatedProducts: topRatedResult.rows,
  });
});


// Update Product - Admin Only
export const updateProduct = catchAsyncError(async (req, res, next) => {
  const {productId} = req.params;
  const { name, description, price, discount_price, category, stock, sizes } = req.body;

  if (!name || !description || !price || !category || !stock) {
    return next(new ErrorHandler("Please provide complete product information.", 400));
  }

  let parsedSizes = [];
  if (sizes) {
    try {
      parsedSizes = typeof sizes === "string" ? JSON.parse(sizes) : sizes;
    } catch (_) {
      parsedSizes = [];
    }
  }

  const product = await database.query(
    `SELECT * FROM products WHERE id = $1`,
    [productId],
  );
  if (product.rows.length === 0) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  // Handle new image uploads if provided
  let updatedImages = product.rows[0].images || [];

  const files = [];
  if (req.files?.images) files.push(req.files.images);
  if (req.files?.image) files.push(req.files.image);

  // Parse existing images sent from frontend (after user removed some)
  let existingImages = updatedImages;
  if (req.body.existingImages !== undefined) {
    try {
      existingImages = JSON.parse(req.body.existingImages);
    } catch (_) {
      existingImages = [];
    }
  }

  // Find which images were removed by the user and delete from Cloudinary
  const removedImages = updatedImages.filter(
    (old) => !existingImages.some((kept) => kept.public_id === old.public_id)
  );
  for (const img of removedImages) {
    if (img.public_id) {
      try { await cloudinary.uploader.destroy(img.public_id); } catch (_) {}
    }
  }

  updatedImages = existingImages;

  if (files.length > 0) {
    const images = files.flatMap((file) => Array.isArray(file) ? file : [file]);
    const newUploadedImages = [];

    for (const image of images) {
      try {
        const result = await cloudinary.uploader.upload(image.tempFilePath, {
          folder: "Ecommerce_Products_Images",
          width: 1000,
          crop: "scale",
          resource_type: "image",
        });
        newUploadedImages.push({ url: result.secure_url, public_id: result.public_id });
      } catch (error) {
        return next(new ErrorHandler(`Image upload failed: ${error.message}`, 500));
      }
    }

    // Append new images to remaining existing ones
    updatedImages = [...existingImages, ...newUploadedImages];
  }

  const result = await database.query(
    `UPDATE products SET name = $1, description = $2, price = $3, discount_price = $4, category = $5, stock = $6, images = $7, sizes = $8 WHERE id = $9 RETURNING *`,
    [name, description, price, discount_price || 0, category, stock, JSON.stringify(updatedImages), JSON.stringify(parsedSizes), productId],
  );

  const updatedProduct = result.rows[0];

  // Notify subscribers if discount was added or changed
  const previousDiscountPrice = Number(product.rows[0].discount_price || 0);
  const newDiscountPrice = Number(discount_price || 0);
  if (newDiscountPrice > 0 && newDiscountPrice !== previousDiscountPrice) {
    notifySubscribersAboutDiscount(updatedProduct);
  }

  res.status(200).json({
    success: true,
    message: "Product updated successfully.",
    product: updatedProduct,
  });
});

// Delete Product - Admin Only
export const deleteProduct = catchAsyncError(async (req, res, next) => {
  const { productId } = req.params;

  const product = await database.query(
    `SELECT * FROM products WHERE id = $1`,
    [productId],
  );
  if (product.rows.length === 0) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  const images = product.rows[0].images;

   const deleteResult = await database.query(
    `DELETE FROM products WHERE id = $1 RETURNING *`,
    [productId],
  );

  if (deleteResult.rowCount === 0) {
    return next(new ErrorHandler("Product not found.", 500));
  }

  //delete images from cloudinary
  if (images && images.length > 0) {
    for (const image of images) {
      try {
        if (image.public_id) {
          await cloudinary.uploader.destroy(image.public_id);
        }
      } catch (err) {
        console.error("Cloudinary deletion error:", err);
      }
    }
  }

  res.status(200).json({
    success: true,
    message: "Product deleted successfully.",
    deleteProduct: deleteResult.rows[0],
  });
});

// Fetch Single Product with Reviews and Reviewer Details
export const fetchSingleProduct = catchAsyncError(async (req, res, next) => {
  const { productId } = req.params;

  const result = await database.query(
    `SELECT p.*,
    COALESCE(
    json_agg(
    json_build_object(
    'review_id', r.id, 
    'rating', r.rating, 
    'comment', r.comment, 
    'reviewer', json_build_object(
    'id', u.id, 'name', u.name, 'avatar', u.avatar))
    ) FILTER (WHERE r.id IS NOT NULL), '[]') 
    AS reviews 
    FROM products p
    LEFT JOIN reviews r ON p.id = r.product_id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE p.id = $1
    GROUP BY p.id`,
    [productId]
  );

  if (result.rows.length === 0) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Product fetched successfully.",
    product: result.rows[0],
  });
});

// Post Product Review
export const postProductReview = catchAsyncError(async (req, res, next) => {
  const { productId } = req.params;
  const { rating, comment } = req.body || {};
  if (!rating || !comment) {
    return next(new ErrorHandler("Please provide rating and comment.", 400));
  }
  const { rows } = await database.query(
    `SELECT oi.product_id 
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN payments p ON p.order_id = o.id
    WHERE o.buyer_id = $1 
    AND oi.product_id = $2 
    AND p.payment_status IN ('Completed', 'Paid')
    LIMIT 1`,
    [req.user.id, productId]
  );

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "After purchasing the product, you can leave a review.",
      });
    }
    const product = await database.query(
      `SELECT * FROM products WHERE id = $1`,
      [productId],
    );

    if (product.rows.length === 0) {
      return next(new ErrorHandler("Product not found.", 404));
    } 

     const existingReview = await database.query(
      `SELECT * FROM reviews WHERE product_id = $1 AND user_id = $2`,
      [productId, req.user.id],
    );

    let review;
    if (existingReview.rows.length > 0) {
      review = await database.query(
        `UPDATE reviews SET rating = $1, comment = $2 WHERE product_id = $3 AND user_id = $4 RETURNING *`,
        [rating, comment, productId, req.user.id],
      );
    }
    else {
      review = await database.query(
        `INSERT INTO reviews (product_id, user_id, rating, comment) VALUES ($1, $2, $3, $4) RETURNING *`,
        [productId, req.user.id, rating, comment]
      );
    }

    const allReviews = await database.query(
      `SELECT AVG(rating) AS average_rating 
      FROM reviews WHERE product_id = $1`,
      [productId]
    );

    const newaverageRating = allReviews.rows[0].average_rating;

    const updateRating = await database.query(
      `UPDATE products SET ratings = $1 WHERE id = $2 RETURNING *`,
      [newaverageRating, productId]
    );

    const userResult = await database.query(
      `SELECT id, name, avatar FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = userResult.rows[0];

    res.status(200).json({
      success: true,
      message: "Review posted successfully.",
      review: {
        review_id: review.rows[0].id,
        rating: review.rows[0].rating,
        comment: review.rows[0].comment,
        reviewer: user
      },
      product: updateRating.rows[0],
    });

});

// Delete Review
export const deleteReview = catchAsyncError(async (req, res, next) => {
  const { productId } = req.params;
  const review = await database.query(`DELETE FROM reviews WHERE product_id = $1 AND user_id = $2 RETURNING *`, [productId, req.user.id]);
  
  if (review.rows.length === 0) {
    return next(new ErrorHandler("Review not found.", 404));
  }

      const allReviews = await database.query(
      `SELECT AVG(rating) AS average_rating 
      FROM reviews WHERE product_id = $1`,
      [productId]
    );

    const newaverageRating = allReviews.rows[0].average_rating;

    const updateRating = await database.query(
      `UPDATE products SET ratings = $1 WHERE id = $2 RETURNING *`,
      [newaverageRating, productId]
    );

  res.status(200).json({
    success: true,
    message: "Your review deleted successfully.",
    review: review.rows[0],
    product: updateRating.rows[0],
  });
});

// Fetch AI Filtered Products
export const fetchAIFilteredProducts = catchAsyncError(async (req, res, next) => {
  const { userPrompt } = req.body;

  if (!userPrompt) {
    return next(new ErrorHandler("Please provide a prompt for AI filtering.", 400));
  }

  // Placeholder for AI filtering logic
  const filtereKeywords = (query) => {
  const stopWords = new Set([
  // Original Words
  "the", "they", "them", "then", "I", "we", "you", "he", "she", "it", "is", 
  "a", "an", "of", "and", "or", "to", "for", "from", "on", "who", "whom", 
  "why", "when", "which", "with", "this", "that", "in", "at", "by", "be", 
  "not", "was", "were", "has", "have", "had", "do", "does", "did", "so", 
  "some", "any", "how", "can", "could", "should", "would", "there", "here", 
  "just", "than", "because", "but", "its", "it's", "if",
  
  // Expanded Pronouns & Possessives
  "me", "my", "mine", "myself", "us", "our", "ours", "ourselves", "your", 
  "yours", "yourself", "yourselves", "him", "his", "himself", "her", "hers", 
  "herself", "itself", "their", "theirs", "themselves", "these", "those",

  // Expanded Verbs ("to be", "to do", "to have", and modals)
  "am", "are", "been", "being", "doing", "having", "done", "will", "shall", 
  "may", "might", "must", "cannot",

  // Common Contractions
  "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", 
  "hasn't", "haven't", "hadn't", "won't", "wouldn't", "can't", "couldn't", 
  "shouldn't", "mustn't", "i'm", "you're", "he's", "she's", "we're", "they're", 
  "i've", "you've", "we've", "they've", "i'd", "you'd", "he'd", "she'd", 
  "we'd", "they'd", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll",

  // Additional Prepositions & Conjunctions
  "about", "above", "across", "after", "against", "along", "among", "around", 
  "before", "behind", "below", "beneath", "beside", "between", "beyond", 
  "down", "during", "except", "into", "near", "off", "out", "over", "past", 
  "through", "under", "until", "up", "upon", "without", "since", "while", 
  "although", "though", "even", "unless",

  // Adverbs, Quantifiers & Question Words
  "where", "what", "too", "very", "really", "also", "always", "never", "only", 
  "quite", "well", "yes", "no", "now", "such", "same", "few", "both", "each", 
  "all", "most", "other", "another", "further", "once",

  // Numbers
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",

  // Punctuation & Symbols
  ".", ",", "!", "?", ">", "<", ";", "`", ":", "\"", "'", "(", ")", "[", "]", 
  "{", "}", "&", "*", "-", "_", "+", "=", "/", "\\", "|", "~", "@", "#", "$", 
  "%", "^"
]);

return query.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(word => !stopWords.has(word)).map((word) => `%${word}%`);
  };

const keywords = filtereKeywords(userPrompt);

// Step 1: Broad SQL Fetching (AI needs context to do semantic search)
// We fetch up to 100 products to let Gemini do the semantic matching,
// instead of strictly filtering by keywords which defeats the AI's purpose.
let result;
if (keywords.length > 0) {
  result = await database.query(
    `SELECT * FROM products
    WHERE name ILIKE ANY($1) OR description ILIKE ANY($1)
    OR category ILIKE ANY($1)
    LIMIT 100`, [keywords]
  );
} else {
  result = { rows: [] };
}

// If keyword match didn't find anything, grab recent 50 products
// so the AI has something to run semantic search against
if (result.rows.length === 0) {
  result = await database.query(`SELECT * FROM products ORDER BY created_at DESC LIMIT 50`);
}

const FilteredProducts = result.rows;

if (FilteredProducts.length === 0) {
  return res.status(200).json({
    success: true,
    message: "No products found matching your criteria.",
    products: [],
  });
}

//Step 2: AI Filtering
const aiResult = await getAIRecommendations(req, res, userPrompt, FilteredProducts);

// If AI succeeded and returned products, use AI results
if (aiResult?.success && aiResult.products.length > 0) {
  return res.status(200).json({
    success: true,
    message: "AI filtered products fetched successfully.",
    products: aiResult.products,
    totalProducts: aiResult.products.length,
  });
}

// AI failed or returned empty — fall back to keyword matched products
return res.status(200).json({
  success: true,
  message: aiResult?.success === false
    ? "AI search unavailable. Showing keyword results."
    : "No exact AI matches. Showing related products.",
  products: FilteredProducts,
  totalProducts: FilteredProducts.length,
});
});

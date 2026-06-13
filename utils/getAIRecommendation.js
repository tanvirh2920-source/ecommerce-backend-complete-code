async function getAIRecommendations(req, res, userPrompt, products) {
    const API_KEY = process.env.GEMINI_API_KEY;
    const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;

    try {
        const simplifiedProducts = products.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price
        }));

        const geminiPrompt = `
        Here is a list of products with their details:
        ${JSON.stringify(simplifiedProducts, null, 2)}
        
        Based on the following user request, filter and suggest the best matching products from the above list.
        User Request: "${userPrompt}"
        
        Only return a JSON array containing the 'id's of the recommended products (e.g., ["id1", "id2"]), without any additional text or explanations.`;

        const response = await fetch(apiURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: geminiPrompt }
                    ]
                }]
            })
        });

        const data = await response.json();
        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        console.log("Raw Gemini Response:", aiResponse);
        const cleanedText = aiResponse.replace(/```json|```/g, "").trim();
        console.log("Cleaned Text:", cleanedText);

        if (!cleanedText) {
            return {
                success: false,
                message: "AI did not return any recommendations.",
                products: []
            };
        }

        let parsedIds = [];
        try {
            let rawData = JSON.parse(cleanedText);
            
            // If it's an object with an array property (e.g., { recommended_ids: [...] })
            if (!Array.isArray(rawData) && typeof rawData === 'object' && rawData !== null) {
                const arrayProp = Object.values(rawData).find(val => Array.isArray(val));
                if (arrayProp) {
                    rawData = arrayProp;
                }
            }

            // If it's an array of objects (e.g., [{id: "..."}])
            if (Array.isArray(rawData)) {
                parsedIds = rawData.map(item => {
                    if (typeof item === 'object' && item !== null) {
                        return item.id || item.ID || Object.values(item)[0];
                    }
                    return item;
                });
            }
            
            // Ensure all IDs are strings to match UUIDs properly
            parsedIds = parsedIds.map(String);
            
            console.log("Extracted IDs:", parsedIds);
        } catch (parseError) {
            console.error("Parse Error:", parseError);
            return {
                success: false,
                message: "Failed to parse AI response.",
                products: []
            };
        }

        const finalProducts = products.filter(p => parsedIds.includes(String(p.id)));
        console.log("Final Products Count:", finalProducts.length);

        return {
            success: true,
            products: finalProducts
        };
    } catch (error) {
        return {
            success: false,
            message: "Internal Server Error while fetching AI recommendations.",
            error: error.message
        };
    }
}

export default getAIRecommendations;
        

           
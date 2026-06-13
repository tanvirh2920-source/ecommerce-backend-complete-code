import dotenv from "dotenv";
dotenv.config({ path: ".env", override: false });
import app from "./app.js";

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
    console.log('Server is running on port', PORT);
});
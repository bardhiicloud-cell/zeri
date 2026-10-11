import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
async function test() {
    console.log("Starting...");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Calling generateContent...");
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: "Hello"
        });
        console.log("Response:", response.text);
    }
    catch (e) {
        console.error("Error:", e);
    }
    console.log("Done");
    process.exit(0);
}
test();

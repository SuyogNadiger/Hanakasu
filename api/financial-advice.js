import process from "node:process";
import { generateFinancialAdvice } from "../server/gemini-financial-advice.js";
import { verifyFirebaseIdToken } from "../server/firebase-auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyFirebaseIdToken(
      request.headers.authorization,
      process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    );
    let body = request.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return response.status(400).json({ error: "Invalid financial analysis request." });
      }
    }
    const result = await generateFinancialAdvice(body);
    return response.status(200).json(result);
  } catch (error) {
    return response
      .status(error.statusCode || 500)
      .json({ error: error.message || "Financial analysis failed." });
  }
}

import process from "node:process";
import { generateFinancialAdvice } from "../../server/gemini-financial-advice.js";
import { verifyFirebaseIdToken } from "../../server/firebase-auth.js";

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    await verifyFirebaseIdToken(
      request.headers.get("authorization"),
      process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    );
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid financial analysis request." }, { status: 400 });
    }
    const result = await generateFinancialAdvice(body);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error.message || "Financial analysis failed." },
      { status: error.statusCode || 500 },
    );
  }
}

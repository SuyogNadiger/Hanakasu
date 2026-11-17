import process from "node:process";
import { matchAccountMention } from "../src/engine/accountMatching.js";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const VALID_TYPES = new Set(["expense", "income", "transfer"]);

function requestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function normalizeTime(value) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(am|pm)$/i.exec(value || "");
  return match ? `${Number(match[1])}:${match[2]} ${match[3].toLowerCase()}` : null;
}

function sanitizeSuggestion(
  candidate,
  categories,
  sourceAccountMatch,
  destinationAccountMatch,
) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw requestError(502, "Gemini returned an invalid transaction suggestion.");
  }

  const suggestion = {};
  if (VALID_TYPES.has(candidate.type)) suggestion.type = candidate.type;
  const type = suggestion.type || "expense";

  const amount = Number(candidate.amount);
  if (Number.isFinite(amount) && amount > 0) suggestion.amount = amount;

  const category = categories.find(
    (item) =>
      item.id === candidate.categoryId &&
      item.type === (type === "income" ? "income" : "expense"),
  );
  if (category) {
    suggestion.categoryId = category.id;
    if (
      typeof candidate.subcategory === "string" &&
      category.subcategories.includes(candidate.subcategory)
    ) {
      suggestion.subcategory = candidate.subcategory;
    }
  }

  const sourceAccount = sourceAccountMatch.account;
  if (
    sourceAccount?.id === candidate.accountId &&
    !sourceAccountMatch.ambiguous &&
    !((type === "income" || type === "transfer") && sourceAccount.type === "credit")
  ) {
    suggestion.accountId = sourceAccountMatch.account.id;
  }
  if (
    type === "transfer" &&
    destinationAccountMatch.account?.id === candidate.toAccountId &&
    !destinationAccountMatch.ambiguous
  ) {
    suggestion.toAccountId = destinationAccountMatch.account.id;
  }

  if (isValidDate(candidate.date)) suggestion.date = candidate.date;
  const time = normalizeTime(candidate.time);
  if (time) suggestion.time = time;

  if (typeof candidate.description === "string") {
    suggestion.description = candidate.description.trim().slice(0, 200);
  }
  return suggestion;
}

export async function suggestTransaction(input, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) {
    throw requestError(503, "Gemini is not configured on the server.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw requestError(400, "Invalid transaction request.");
  }

  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text || text.length > 500) {
    throw requestError(400, "Enter a transaction description under 500 characters.");
  }

  const categories = Array.isArray(input.categories)
    ? input.categories
        .filter((category) => category && typeof category.id === "string")
        .slice(0, 100)
        .map((category) => ({
          id: category.id,
          name: String(category.name || "").slice(0, 80),
          type: category.type,
          subcategories: Array.isArray(category.subcategories)
            ? category.subcategories
                .filter((item) => typeof item === "string")
                .slice(0, 50)
            : [],
          keywords: Array.isArray(category.keywords)
            ? category.keywords
                .filter((item) => typeof item === "string")
                .slice(0, 50)
            : [],
        }))
    : [];
  const accounts = Array.isArray(input.accounts)
    ? input.accounts
        .filter(
          (account) =>
            account &&
            typeof account.id === "string",
        )
        .slice(0, 50)
        .map((account) => ({
          id: account.id,
          name: String(account.name || "").slice(0, 80),
          nickname: String(account.nickname || "").slice(0, 80),
          brand: String(account.brand || "").slice(0, 80),
          type: account.type,
        }))
    : [];
  const typeText = text.toLowerCase();
  const requestedType = /\b(transfer|move|moved|send|sent)\b/.test(typeText)
    ? "transfer"
    : /\b(salary|income|credited|received|bonus|dividend|ipo|gift|refund|cashback)\b/.test(typeText)
      ? "income"
      : "expense";
  const destinationClause =
    /\b(?:to|into)\s+(.+?)(?=\s+\bfrom\b|\s+\bfor\b|$)/i.exec(text)?.[1];
  const sourceSearchText = destinationClause
    ? text.replace(destinationClause, " ")
    : text;
  const sourceAccounts = accounts.filter(
    (account) =>
      account.type !== "liquid_mf" &&
      account.type !== "emergency_reserve" &&
      !((requestedType === "income" || requestedType === "transfer") && account.type === "credit"),
  );
  const sourceAccountMatch = matchAccountMention(sourceSearchText, sourceAccounts);
  const reserveAccount = accounts.find(
    (account) => account.type === "emergency_reserve",
  );
  const reserveMentioned =
    requestedType === "transfer" &&
    /\b(?:liquid\s*(?:mf|fund)|emergency\s+reserve)\b/i.test(destinationClause || "");
  const destinationAccountMatch =
    reserveMentioned && reserveAccount
      ? { account: reserveAccount, ambiguous: false, matchedTokens: [] }
      : requestedType === "transfer" && destinationClause
      ? matchAccountMention(
          destinationClause,
          accounts.filter((account) => account.type !== "credit"),
        )
      : { account: null, ambiguous: false, matchedTokens: [] };

  const response = await fetch(`${GEMINI_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: [
              "Interpret the user's text as one personal-finance transaction.",
              "Return only fields supported by the text; do not invent amounts, dates, accounts, or categories.",
              "Use a source account only when its supplied name, nickname, brand, or distinctive abbreviation is explicitly mentioned; never guess a default account.",
              "Choose category IDs and subcategories only from the supplied lists.",
              "Use expense, income, or transfer. Use the supplied current date for relative dates.",
              "Preserve the user's merchant, payee, or purpose as the description. Copy an explicit note or memo faithfully; do not invent or replace it with a category. Omit only account selectors, amount, date/time, and transaction filler words.",
              "Return time in h:mm am/pm format when the user gives a time.",
            ].join(" "),
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify({
                currentDate:
                  typeof input.today === "string" ? input.today : "",
                transactionText: text,
                categories,
                accounts,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", enum: ["expense", "income", "transfer"] },
            amount: { type: "NUMBER" },
            accountId: { type: "STRING" },
            toAccountId: { type: "STRING" },
            categoryId: { type: "STRING" },
            subcategory: { type: "STRING" },
            description: { type: "STRING" },
            date: { type: "STRING" },
            time: { type: "STRING" },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errorBody = await response.json();
      detail = typeof errorBody.error?.message === "string"
        ? errorBody.error.message
            .split(apiKey)
            .join("[redacted]")
            .replace(/\s+/g, " ")
            .slice(0, 240)
        : "";
    } catch {
      detail = "";
    }
    throw requestError(
      502,
      detail
        ? `Gemini API returned HTTP ${response.status}: ${detail}`
        : `Gemini API returned HTTP ${response.status}.`,
    );
  }

  const result = await response.json();
  const generatedText = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!generatedText) {
    throw requestError(502, "Gemini could not interpret that transaction.");
  }

  let candidate;
  try {
    candidate = JSON.parse(generatedText);
  } catch {
    throw requestError(502, "Gemini returned an unreadable transaction suggestion.");
  }

  return {
    suggestion: sanitizeSuggestion(
      candidate,
      categories,
      sourceAccountMatch,
      destinationAccountMatch,
    ),
  };
}

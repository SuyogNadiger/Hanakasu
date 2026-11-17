import assert from "node:assert/strict";
import { test } from "node:test";
import { generateFinancialAdvice } from "./gemini-financial-advice.js";

const validSummary = {
  selectedMonth: "2026-03",
  months: [{
    month: "2026-03",
    income: 50000,
    expenses: 20000,
    incomeByCategory: [{ category: "Salary", amount: 50000 }],
    expensesByCategory: [{ category: "Food", amount: 20000 }],
  }],
};

test("financial advice requires a server Gemini key", async () => {
  await assert.rejects(
    generateFinancialAdvice(validSummary, ""),
    error => error.statusCode === 503,
  );
});

test("financial advice rejects invalid or negative financial summaries", async () => {
  await assert.rejects(
    generateFinancialAdvice({ ...validSummary, selectedMonth: "not-a-month" }, "test-key"),
    error => error.statusCode === 400,
  );
  await assert.rejects(
    generateFinancialAdvice({
      ...validSummary,
      months: [{ ...validSummary.months[0], expenses: -1 }],
    }, "test-key"),
    error => error.statusCode === 400,
  );
});

test("financial advice sends aggregate values only and validates Gemini output", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /models\/gemini-3\.5-flash-lite:generateContent$/);
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                summary: "Income exceeded spending this month.",
                observations: ["Food was the largest expense category."],
                actions: ["Review recurring food costs."],
              }),
            }],
          },
        }],
      }),
    };
  };

  try {
    const result = await generateFinancialAdvice({
      ...validSummary,
      accountName: "Private Checking",
      transactionDescription: "Private purchase detail",
    }, "test-key");
    const sentContent = JSON.stringify(requestBody.contents);
    assert.equal(result.summary, "Income exceeded spending this month.");
    assert.equal(sentContent.includes("Private Checking"), false);
    assert.equal(sentContent.includes("Private purchase detail"), false);
    assert.equal(sentContent.includes('20000'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("financial advice retries a transient Gemini overload", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return Response.json(
        { error: { message: "Model is temporarily overloaded." } },
        { status: 503 },
      );
    }
    return Response.json({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              summary: "Spending stayed within income.",
              observations: [],
              actions: [],
            }),
          }],
        },
      }],
    });
  };

  try {
    const result = await generateFinancialAdvice(validSummary, "test-key");
    assert.equal(attempts, 2);
    assert.equal(result.summary, "Spending stayed within income.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("financial advice falls back to the stable lightweight model after primary overload", async () => {
  const originalFetch = globalThis.fetch;
  const modelUrls = [];
  globalThis.fetch = async (url) => {
    modelUrls.push(url);
    if (url.includes("gemini-3.5-flash-lite")) {
      return Response.json({ error: { message: "Model is overloaded." } }, { status: 503 });
    }
    assert.match(url, /models\/gemini-3\.1-flash-lite:generateContent$/);
    return Response.json({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              summary: "Spending stayed within income.",
              observations: [],
              actions: [],
            }),
          }],
        },
      }],
    });
  };

  try {
    const result = await generateFinancialAdvice(validSummary, "test-key");
    assert.equal(modelUrls.filter(url => url.includes("gemini-3.5-flash-lite")).length, 2);
    assert.equal(modelUrls.filter(url => url.includes("gemini-3.1-flash-lite")).length, 1);
    assert.equal(result.summary, "Spending stayed within income.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("financial advice reports temporary overload after bounded retries", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return Response.json(
      { error: { message: "Model is temporarily overloaded." } },
      { status: 503 },
    );
  };

  try {
    await assert.rejects(
      generateFinancialAdvice(validSummary, "test-key"),
      error => error.statusCode === 503 && /temporarily busy/i.test(error.message),
    );
    assert.equal(attempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

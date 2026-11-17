import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { suggestTransaction } from "./gemini-transaction.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("suggestions use the active model and are limited to known transaction data", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(url, /models\/gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(options.headers["x-goog-api-key"], "test-key");
    const requestBody = JSON.parse(options.body);
    assert.equal(JSON.stringify(requestBody).includes("currentBalance"), false);
    return Response.json({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              type: "income",
              amount: 42000,
              accountId: "credit-card",
              categoryId: "salary",
              subcategory: "Monthly Salary",
              date: "2026-02-31",
              time: "09:30 PM",
              description: "Monthly salary",
            }),
          }],
        },
      }],
    });
  };

  const result = await suggestTransaction({
    text: "salary 42000",
    today: "2026-11-17",
    categories: [{
      id: "salary",
      name: "Salary",
      type: "income",
      subcategories: ["Monthly Salary"],
    }],
    accounts: [{ id: "credit-card", name: "Card", type: "credit" }],
  }, "test-key");

  assert.deepEqual(result.suggestion, {
    type: "income",
    amount: 42000,
    categoryId: "salary",
    subcategory: "Monthly Salary",
    time: "9:30 pm",
    description: "Monthly salary",
  });
});

test("emergency reserve is accepted as a destination but never as a source", async () => {
  globalThis.fetch = async () => Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            type: "transfer",
            amount: 500,
            accountId: "reserve",
            toAccountId: "reserve",
          }),
        }],
      },
    }],
  });

  const result = await suggestTransaction({
    text: "move 500 to emergency reserve",
    categories: [],
    accounts: [
      { id: "cash", name: "Cash Wallet", type: "cash" },
      { id: "reserve", name: "Emergency Reserve", type: "emergency_reserve" },
    ],
  }, "test-key");

  assert.deepEqual(result.suggestion, {
    type: "transfer",
    amount: 500,
    toAccountId: "reserve",
  });
});

test("bank aliases and acronyms validate Gemini's source account suggestion", async () => {
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              type: "expense",
              amount: 300,
              accountId: "union",
              description: "Dinner with friends",
            }),
          }],
        },
      }],
    });
  };

  const result = await suggestTransaction({
    text: "₹300 dinner with friends from UBI",
    categories: [],
    accounts: [{
      id: "union",
      name: "Union Bank of India",
      nickname: "Union",
      brand: "Union Bank of India",
      type: "bank",
    }],
  }, "test-key");

  assert.equal(result.suggestion.accountId, "union");
  assert.equal(requestBody.contents[0].parts[0].text.includes('"nickname":"Union"'), true);
  assert.equal(result.suggestion.description, "Dinner with friends");
});

test("Gemini cannot assign a default account that the text does not mention", async () => {
  globalThis.fetch = async () => Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            type: "expense",
            amount: 100,
            accountId: "union",
          }),
        }],
      },
    }],
  });

  const result = await suggestTransaction({
    text: "coffee 100",
    categories: [],
    accounts: [
      { id: "cash", name: "Cash Wallet", type: "cash" },
      { id: "union", name: "Union Bank of India", type: "bank" },
    ],
  }, "test-key");

  assert.deepEqual(result.suggestion, { type: "expense", amount: 100 });
});

test("Gemini error details are surfaced without exposing the server key", async () => {
  globalThis.fetch = async () => Response.json(
    { error: { message: "Model not found for test-key" } },
    { status: 404 },
  );
  await assert.rejects(
    suggestTransaction({ text: "coffee 100" }, "test-key"),
    error => error.statusCode === 502 &&
      error.message.includes("Model not found") &&
      !error.message.includes("test-key"),
  );
});

test("transfers can use Liquid MF as a destination but never as a source", async () => {
  globalThis.fetch = async () => Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            type: "transfer",
            amount: 500,
            accountId: "liquid",
            toAccountId: "liquid",
          }),
        }],
      },
    }],
  });

  const result = await suggestTransaction({
    text: "move 500 to Liquid MF",
    categories: [],
    accounts: [{ id: "liquid", name: "Liquid MF", type: "liquid_mf" }],
  }, "test-key");

  assert.deepEqual(result.suggestion, {
    type: "transfer",
    amount: 500,
    toAccountId: "liquid",
  });
});

test("missing Gemini configuration is reported before making a request", async () => {
  await assert.rejects(
    suggestTransaction({ text: "coffee 100" }, ""),
    (error) => error.statusCode === 503,
  );
});

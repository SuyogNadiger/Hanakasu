import assert from "node:assert/strict";
import { test } from "node:test";
import { forwardWebhookRequest } from "./webhook-proxy.js";

test("legacy global database actions are no longer available", async () => {
  await assert.rejects(
    forwardWebhookRequest("GET", undefined, "https://example.test/"),
    (error) => error.statusCode === 405,
  );
  await assert.rejects(
    forwardWebhookRequest(
      "POST",
      JSON.stringify({ action: "sync_db" }),
      "https://example.test/",
    ),
    (error) => error.statusCode === 403,
  );
});

test("webhook rejects non-HTTPS destinations", async () => {
  await assert.rejects(
    forwardWebhookRequest(
      "POST",
      JSON.stringify({ action: "send_email", email: "owner@example.com" }),
      "http://example.test/",
      "owner@example.com",
    ),
    (error) => error.statusCode === 500,
  );
});

test("webhook only allows sending to the authenticated account email", async () => {
  await assert.rejects(
    forwardWebhookRequest(
      "POST",
      JSON.stringify({ action: "send_email", email: "other@example.com" }),
      "https://example.test/",
      "owner@example.com",
    ),
    (error) =>
      error.statusCode === 403 &&
      error.message ===
        "Email alerts can only be sent to your signed-in account email.",
  );
});

test("webhook surfaces delivery failures reported in a successful response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        error: "Mail service rejected the recipient.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  try {
    await assert.rejects(
      forwardWebhookRequest(
        "POST",
        JSON.stringify({ action: "send_email", email: "owner@example.com" }),
        "https://example.test/",
        "owner@example.com",
      ),
      (error) =>
        error.statusCode === 502 &&
        error.message === "Mail service rejected the recipient.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyFirebaseIdToken } from "./firebase-auth.js";

test("private API requests reject missing credentials", async () => {
  await assert.rejects(
    verifyFirebaseIdToken("", "project-id"),
    (error) => error.statusCode === 401,
  );
});

test("token verification requires a configured Firebase project", async () => {
  await assert.rejects(
    verifyFirebaseIdToken("Bearer token"),
    (error) => error.statusCode === 503,
  );
});

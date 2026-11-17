import assert from "node:assert/strict";
import { test } from "node:test";

test("user data paths are owned by the authenticated UID", async () => {
  const rules = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
  );
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /appData\/current/);
});

import test from "node:test";
import assert from "node:assert/strict";
import en from "../src/i18n/en.js";
import fa from "../src/i18n/fa.js";
import ps from "../src/i18n/ps.js";
test("every English interface key is translated in Dari and Pashto", () => {
  for (const key of Object.keys(en)) {
    assert.equal(typeof fa[key], "string", `Dari missing ${key}`);
    assert.equal(typeof ps[key], "string", `Pashto missing ${key}`);
  }
});
test("the combined SQL matches the ordered migrations exactly", async () => {
  const { readFile, readdir } = await import("node:fs/promises");
  const combined = await readFile("supabase/all-migrations.sql", "utf8");
  for (const f of (await readdir("supabase/migrations")).sort()) {
    const sql = (await readFile(`supabase/migrations/${f}`, "utf8"))
      .replace(/^\uFEFF/, "")
      .trim();
    assert.ok(combined.includes(sql), `${f} is not current in combined SQL`);
  }
});

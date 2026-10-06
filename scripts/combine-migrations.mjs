import { readFile, readdir, writeFile } from "node:fs/promises";
const files = (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const content = await Promise.all(
  files.map(
    async (f) =>
      `-- ${f}\n${(await readFile(`supabase/migrations/${f}`, "utf8")).replace(/^\uFEFF/, "").trim()}\n`,
  ),
);
await writeFile(
  "supabase/all-migrations.sql",
  `-- COMPLETE MIGRATIONS: run once in a fresh Supabase project's SQL Editor.\n-- Do not also run the individual migration files.\nbegin;\n\n${content.join("\n")}\ncommit;\n`,
);
console.log("Generated supabase/all-migrations.sql");

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const isWindows = process.platform === "win32";
const command = isWindows
  ? 'npx.cmd supabase gen types typescript --local'
  : "npx supabase gen types typescript --local";

const result = spawnSync(command, {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  shell: true,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || "supabase gen types failed\n");
  process.exit(result.status ?? 1);
}

const out = result.stdout;
if (!out.includes("export type Database")) {
  process.stderr.write("unexpected gen types output (is the local stack running?)\n");
  process.exit(1);
}

writeFileSync("src/lib/supabase/database.types.ts", out);
process.stdout.write("wrote src/lib/supabase/database.types.ts\n");

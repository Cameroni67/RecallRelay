#!/usr/bin/env node
// LiteSVM program-test runner, portable across Windows and WSL.
//
// tsc emits the suite into .sbf-test-build, but the sources import each other
// without extensions (moduleResolution: bundler) while Node needs explicit
// .js suffixes. We copy the emit out of the repo, rewrite those specifiers,
// and run `node --test` there so the repo tree stays clean.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This script is expected to run under the platform's native node (the
// test-sbf.mjs shim re-enters WSL on Windows), so node:path is correct here.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const emitDir = join(root, ".sbf-test-build");
const runDir = join(root, ".sbf-test-run");
const soPath = join(root, "solana", "recallrelay-program", "target", "deploy", "recallrelay_program.so");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(soPath)) {
  console.error(`missing ${soPath}\nrun scripts/build-sbf.sh first`);
  process.exit(1);
}

rmSync(runDir, { recursive: true, force: true });
run("npx", ["tsc", "-p", "tsconfig.sbf.emit.json"]);

mkdirSync(runDir, { recursive: true });
for (const file of readdirSync(emitDir)) {
  if (!file.endsWith(".js") && !file.endsWith(".mjs")) continue;
  const source = readFileSync(join(emitDir, file), "utf8");
  const fixed = source.replace(/from ["'](\.\/[^"']+)(\.js)?["']/g, 'from "./$1.js"');
  writeFileSync(join(runDir, file), fixed);
}

writeFileSync(join(runDir, "package.json"), '{ "type": "module" }\n');

// The test-sbf.mjs shim guarantees this runs under a node that can load the
// linux-x64 litesvm binding, so just exec the suite. The emit dir is
// gitignored; runDir is scratch space we own and clean up front.
const env = {
  ...process.env,
  RECALLRELAY_SO_PATH: soPath,
};

const result = spawnSync(process.execPath, ["--test", join(runDir, "program.test.mjs")], {
  cwd: runDir,
  stdio: "inherit",
  env,
});
process.exit(result.status ?? 1);

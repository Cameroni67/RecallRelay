#!/usr/bin/env node
// Entrypoint for `npm run test:sbf`, portable across Windows and WSL.
//
// The LiteSVM suite needs the linux-x64 native binding, which only exists in
// WSL. npm on a Windows checkout hands us node.exe, which cannot dlopen that
// binding, so here we re-enter the distro and hand off to the real runner.
// On a Linux checkout we exec the runner directly.

import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const root = resolve(scriptsDir, "..");
const runner = join(scriptsDir, "run-sbf-tests.mjs");

if (process.platform === "win32") {
  const distro = process.env.WSL_DISTRO_NAME ?? "Ubuntu";
  // WSL mounts drives lowercased, so C:\ becomes /mnt/c regardless of the
  // casing Windows used.
  const linuxRoot = `/mnt/${root.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase())}`;
  const command = `cd ${linuxRoot} && exec /usr/bin/node scripts/run-sbf-tests.mjs`;
  const result = spawnSync("wsl", ["-d", distro, "--", "bash", "-c", command], {
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}

const result = spawnSync(process.execPath, [runner], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
process.exit(result.status ?? 1);

#!/bin/bash
set -e
cd /mnt/c/Users/okuma/Desktop/recallrelay

BUILD_SRC=.sbf-test-build
BUILD=/tmp/recallrelay-sbf-test
rm -rf "$BUILD_SRC" "$BUILD"

npx tsc -p tsconfig.sbf.emit.json
mkdir -p "$BUILD"
cp "$BUILD_SRC"/*.js "$BUILD_SRC"/*.mjs "$BUILD"/ 2>/dev/null || true

node -e '
const fs = require("fs");
const path = require("path");
const dir = process.argv[1];
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".js") && !f.endsWith(".mjs")) continue;
  const p = path.join(dir, f);
  let src = fs.readFileSync(p, "utf8");
  src = src.replace(/from ["'"'"'](\.\/[^"'"'"']+)(\.js)?["'"'"']/g, "from \"./$1.js\"");
  fs.writeFileSync(p, src);
}
console.log("fixed imports in", dir);
' "$BUILD"

printf '%s\n' '{ "type": "module" }' > "$BUILD/package.json"

ln -sfn /mnt/c/Users/okuma/Desktop/recallrelay/node_modules "$BUILD/node_modules"

export RECALLRELAY_SO_PATH=/mnt/c/Users/okuma/Desktop/recallrelay/solana/recallrelay-program/target/deploy/recallrelay_program.so
node --test "$BUILD/program.test.mjs"

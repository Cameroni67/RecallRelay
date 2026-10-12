#!/bin/bash
set -e
source "$HOME/.cargo/env" 2>/dev/null || true
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
cd /mnt/c/Users/okuma/Desktop/recallrelay/solana/recallrelay-program
cargo build-sbf 2>&1 | tail -25

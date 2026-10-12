// Public Solana deployment constants for RecallRelay.
//
// Only public, non-secret values live here. The program keypair is stored at
// `solana/recallrelay-program/program-keypair.json` and is gitignored.

/** The cluster RecallRelay targets. */
export const CLUSTER = "devnet" as const;

/**
 * RecallRelay on-chain program ID.
 *
 * Deployed to Solana Devnet (2026-10-12, slot 510285095). Deploy transaction
 * `258gQKddgTJHnnAuj1aJ4vGZNhAGbFV1aCCFRUdm3Libi6hvdyXrW8TbShpQVS7mRRasnVxg63VtAQdUzzvSsaPo`;
 * full deployment record in `solana/build-info.md`.
 */
export const PROGRAM_ID = "GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP";

/** RPC endpoint used by the client and reconciliation routes. */
export const RPC_URL = "https://api.devnet.solana.com";

/** Explorer base URL. */
export const EXPLORER_URL = "https://explorer.solana.com";

/** Build an explorer link for a transaction signature. */
export function explorerTxLink(signature: string): string {
  return `${EXPLORER_URL}/tx/${signature}?cluster=${CLUSTER}`;
}

/** Build an explorer link for an account address. */
export function explorerAccountLink(address: string): string {
  return `${EXPLORER_URL}/address/${address}?cluster=${CLUSTER}`;
}

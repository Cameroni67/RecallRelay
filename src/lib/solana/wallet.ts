// Minimal injected-wallet helper (Phantom/Solflare standard provider).
//
// Phase 3 signs transactions with the browser wallet: the server prepares an
// unsigned transaction, this helper asks the injected provider to sign it,
// and the signed bytes go back to the server only to be *sent* — never to be
// trusted as state. No wallet-adapter dependency; `window.solana` covers the
// Phantom/Solflare wallet-standard providers.

import { VersionedTransaction } from "@solana/web3.js";

type InjectedProvider = {
  isPhantom?: boolean;
  publicKey?: { toBase58: () => string };
  connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
  signTransaction: <T extends VersionedTransaction>(tx: T) => Promise<T>;
};

function getProvider(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const injected = (window as unknown as { solana?: InjectedProvider }).solana;
  return injected ?? null;
}

/** True when an injected wallet is available in this browser. */
export function hasInjectedWallet(): boolean {
  return getProvider() !== null;
}

/** Connect and return the wallet's public key, or throw a friendly error. */
export async function connectWallet(): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No Solana wallet extension found. Install Phantom or Solflare to continue.");
  }
  const { publicKey } = await provider.connect();
  return publicKey.toBase58();
}

/**
 * Ask the wallet to sign a base64-encoded transaction prepared by the server
 * and return the signed bytes (base64), ready to send.
 */
export async function signPreparedTransaction(transactionBase64: string): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No Solana wallet extension found. Install Phantom or Solflare to continue.");
  }
  const tx = VersionedTransaction.deserialize(
    Uint8Array.from(atob(transactionBase64), (c) => c.charCodeAt(0)),
  );
  const signed = await provider.signTransaction(tx);
  return btoa(String.fromCharCode(...signed.serialize()));
}

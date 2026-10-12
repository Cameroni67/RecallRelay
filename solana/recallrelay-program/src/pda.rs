//! Deterministic PDA derivation.
//!
//! Seeds are hashed identically in the TypeScript client (`src/lib/solana/pdas.ts`):
//!
//! * manufacturer: `["manufacturer", sha256(manufacturer_uuid)]`
//! * product:      `["product", manufacturer_pda, sha256(product_uuid)]`
//!
//! `sha256` here is Solana's `hashv`, which matches `@solana/web3.js`
//! `PublicKey.findProgramAddressSync` when the client uses the same inputs.

use solana_program::{
    hash,
    pubkey::Pubkey,
};

use crate::state::{MANUFACTURER_SIZE, PRODUCT_SIZE};

/// Seeds a manufacturer PDA.
///
/// `uuid_hash` must be the raw 32-byte `sha256` of the manufacturer UUID —
/// not the UUID string.
pub fn manufacturer_seeds<'a>(uuid_hash: &'a [u8; 32]) -> [&'a [u8]; 2] {
    [b"manufacturer", uuid_hash.as_ref()]
}

/// Seeds a product PDA, given the owning manufacturer's PDA.
pub fn product_seeds<'a>(uuid_hash: &'a [u8; 32], manufacturer_pda: &'a Pubkey) -> [&'a [u8]; 3] {
    [b"product", manufacturer_pda.as_ref(), uuid_hash.as_ref()]
}

/// Derive the manufacturer PDA and its bump.
pub fn derive_manufacturer_pda(program_id: &Pubkey, uuid_hash: &[u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(&manufacturer_seeds(uuid_hash), program_id)
}

/// Derive the product PDA and its bump.
pub fn derive_product_pda(
    program_id: &Pubkey,
    uuid_hash: &[u8; 32],
    manufacturer_pda: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(&product_seeds(uuid_hash, manufacturer_pda), program_id)
}

/// Convenience: expected account size for a manufacturer PDA.
pub fn manufacturer_size() -> usize {
    MANUFACTURER_SIZE
}

/// Convenience: expected account size for a product PDA.
pub fn product_size() -> usize {
    PRODUCT_SIZE
}

/// Hash a UUID string (or any identifier) into the 32-byte seed form.
///
/// The client passes the *already hashed* bytes; this helper exists so the
/// processor can hash a raw UUID when given one.
pub fn hash_identifier(identifier: &[u8]) -> [u8; 32] {
    hash::hash(identifier).to_bytes()
}

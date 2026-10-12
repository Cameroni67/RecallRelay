//! On-chain account state for RecallRelay.
//!
//! Two account types are persisted, both derived deterministically:
//!
//! * [`Manufacturer`]  — PDA seeds `["manufacturer", sha256(manufacturer_uuid)]`
//! * [`Product`]       — PDA seeds `["product", manufacturer_pda, sha256(product_uuid)]`
//!
//! Neither account stores personally identifying information. Serial numbers,
//! product names, imagery and owner email stay off-chain in Supabase; the chain
//! holds only opaque UUID hashes, the authority/owner keys, and status.

use solana_program::pubkey::Pubkey;

/// Discriminator byte prefixing every account this program owns.
///
/// Kept to a single byte so account size can be computed as a constant.
pub const ACCOUNT_DISCRIMINATOR_MANUFACTURER: u8 = 1;
pub const ACCOUNT_DISCRIMINATOR_PRODUCT: u8 = 2;

/// Current layout version, written into every account.
pub const STATE_VERSION: u8 = 1;

/// Fixed size of a [`Manufacturer`] account, in bytes.
pub const MANUFACTURER_SIZE: usize = 1 + 1 + 32 + 32 + 1 + 1 + 8;

/// Fixed size of a [`Product`] account, in bytes.
pub const PRODUCT_SIZE: usize = 1 + 1 + 32 + 32 + 32 + 1 + 4 + 1 + 8;

/// Lifecycle status of a [`Product`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ProductStatus {
    /// Registered and transferable.
    Active = 0,
    /// No longer transferable.
    Retired = 1,
}

impl ProductStatus {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::Active),
            1 => Some(Self::Retired),
            _ => None,
        }
    }
}

/// A manufacturer's on-chain registration.
///
/// `uuid_hash` is `sha256(manufacturer_uuid_bytes)`; the raw UUID is never
/// written to the chain.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Manufacturer {
    pub discriminator: u8,
    pub version: u8,
    /// `sha256` of the manufacturer's UUID (32 bytes).
    pub uuid_hash: [u8; 32],
    /// Wallet allowed to register products and to retire them.
    pub authority: Pubkey,
    /// Whether the manufacturer is currently active.
    pub is_active: bool,
    pub bump: u8,
    /// Slot at which the account was created.
    pub created_slot: u64,
}

impl Manufacturer {
    pub fn new(uuid_hash: [u8; 32], authority: Pubkey, bump: u8, created_slot: u64) -> Self {
        Self {
            discriminator: ACCOUNT_DISCRIMINATOR_MANUFACTURER,
            version: STATE_VERSION,
            uuid_hash,
            authority,
            is_active: true,
            bump,
            created_slot,
        }
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(MANUFACTURER_SIZE);
        out.push(self.discriminator);
        out.push(self.version);
        out.extend_from_slice(&self.uuid_hash);
        out.extend_from_slice(self.authority.as_ref());
        out.push(self.is_active as u8);
        out.push(self.bump);
        out.extend_from_slice(&self.created_slot.to_le_bytes());
        out
    }

    pub fn from_bytes(data: &[u8]) -> Option<Self> {
        if data.len() < MANUFACTURER_SIZE {
            return None;
        }
        if data[0] != ACCOUNT_DISCRIMINATOR_MANUFACTURER {
            return None;
        }
        let version = data[1];
        let mut uuid_hash = [0u8; 32];
        uuid_hash.copy_from_slice(&data[2..34]);
        let authority = Pubkey::new_from_array(<[u8; 32]>::try_from(&data[34..66]).ok()?);
        let is_active = data[66] != 0;
        let bump = data[67];
        let created_slot = u64::from_le_bytes(<[u8; 8]>::try_from(&data[68..76]).ok()?);
        Some(Self {
            discriminator: ACCOUNT_DISCRIMINATOR_MANUFACTURER,
            version,
            uuid_hash,
            authority,
            is_active,
            bump,
            created_slot,
        })
    }
}

/// A registered product unit.
///
/// Ownership is authoritative here: `current_owner` is the source of truth for
/// who holds the unit. Off-chain state is reconciled from this account.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Product {
    pub discriminator: u8,
    pub version: u8,
    /// `sha256` of the product unit's UUID (32 bytes).
    pub uuid_hash: [u8; 32],
    /// PDA of the owning manufacturer.
    pub manufacturer: Pubkey,
    /// Wallet currently holding this unit.
    pub current_owner: Pubkey,
    pub status: ProductStatus,
    /// Incremented on every successful transfer.
    pub transfer_count: u32,
    pub bump: u8,
    /// Slot at which the product was registered.
    pub created_slot: u64,
}

impl Product {
    pub fn new(
        uuid_hash: [u8; 32],
        manufacturer: Pubkey,
        current_owner: Pubkey,
        bump: u8,
        created_slot: u64,
    ) -> Self {
        Self {
            discriminator: ACCOUNT_DISCRIMINATOR_PRODUCT,
            version: STATE_VERSION,
            uuid_hash,
            manufacturer,
            current_owner,
            status: ProductStatus::Active,
            transfer_count: 0,
            bump,
            created_slot,
        }
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(PRODUCT_SIZE);
        out.push(self.discriminator);
        out.push(self.version);
        out.extend_from_slice(&self.uuid_hash);
        out.extend_from_slice(self.manufacturer.as_ref());
        out.extend_from_slice(self.current_owner.as_ref());
        out.push(self.status as u8);
        out.extend_from_slice(&self.transfer_count.to_le_bytes());
        out.push(self.bump);
        out.extend_from_slice(&self.created_slot.to_le_bytes());
        out
    }

    pub fn from_bytes(data: &[u8]) -> Option<Self> {
        if data.len() < PRODUCT_SIZE {
            return None;
        }
        if data[0] != ACCOUNT_DISCRIMINATOR_PRODUCT {
            return None;
        }
        let version = data[1];
        let mut uuid_hash = [0u8; 32];
        uuid_hash.copy_from_slice(&data[2..34]);
        let manufacturer = Pubkey::new_from_array(<[u8; 32]>::try_from(&data[34..66]).ok()?);
        let current_owner = Pubkey::new_from_array(<[u8; 32]>::try_from(&data[66..98]).ok()?);
        let status = ProductStatus::from_u8(data[98])?;
        let transfer_count = u32::from_le_bytes(<[u8; 4]>::try_from(&data[99..103]).ok()?);
        let bump = data[103];
        let created_slot = u64::from_le_bytes(<[u8; 8]>::try_from(&data[104..112]).ok()?);
        Some(Self {
            discriminator: ACCOUNT_DISCRIMINATOR_PRODUCT,
            version,
            uuid_hash,
            manufacturer,
            current_owner,
            status,
            transfer_count,
            bump,
            created_slot,
        })
    }
}

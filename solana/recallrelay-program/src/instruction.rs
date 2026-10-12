//! Instruction definitions and borsh-free (manual) encoding.

use solana_program::pubkey::Pubkey;

use crate::error::RecallRelayError;

/// Instruction discriminants, in wire order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum RecallRelayInstruction {
    /// Initialize a manufacturer PDA.
    ///
    /// Accounts (in order):
    /// 0. `writable` — manufacturer PDA
    /// 1. `signer`   — manufacturer authority
    /// 2. `readonly` — system program
    ///
    /// Data: `sha256(manufacturer_uuid)` (32 bytes)
    InitializeManufacturer = 0,

    /// Register a product PDA owned by a wallet.
    ///
    /// Accounts (in order):
    /// 0. `writable` — product PDA
    /// 1. `readonly` — manufacturer PDA
    /// 2. `signer`   — manufacturer authority
    /// 3. `readonly` — current owner wallet
    /// 4. `readonly` — system program
    ///
    /// Data: `sha256(product_uuid)` (32 bytes)
    RegisterProduct = 1,

    /// Transfer product ownership to a new wallet.
    ///
    /// Accounts (in order):
    /// 0. `writable` — product PDA
    /// 1. `signer`   — current owner
    /// 2. `readonly` — new owner wallet
    ///
    /// Data: none
    TransferProduct = 2,

    /// Retire a product, making it non-transferable.
    ///
    /// Accounts (in order):
    /// 0. `writable` — product PDA
    /// 1. `signer`   — manufacturer authority
    ///
    /// Data: none
    RetireProduct = 3,
}

impl RecallRelayInstruction {
    /// Decode an instruction from raw `instruction_data`.
    pub fn unpack(input: &[u8]) -> Result<Self, RecallRelayError> {
        let (&disc, rest) = input
            .split_first()
            .ok_or(RecallRelayError::InvalidInstruction)?;
        match disc {
            0 => {
                if rest.len() != 32 {
                    return Err(RecallRelayError::InvalidInstruction);
                }
                Ok(Self::InitializeManufacturer)
            }
            1 => {
                if rest.len() != 32 {
                    return Err(RecallRelayError::InvalidInstruction);
                }
                Ok(Self::RegisterProduct)
            }
            2 => Ok(Self::TransferProduct),
            3 => Ok(Self::RetireProduct),
            _ => Err(RecallRelayError::InvalidInstruction),
        }
    }

    /// The 32-byte UUID hash payload carried by `InitializeManufacturer` / `RegisterProduct`.
    pub fn uuid_hash(input: &[u8]) -> Result<[u8; 32], RecallRelayError> {
        let rest = &input[1..];
        <[u8; 32]>::try_from(rest).map_err(|_| RecallRelayError::InvalidInstruction)
    }
}

/// A decoded instruction plus its 32-byte payload (when present).
pub struct DecodedInstruction {
    pub variant: RecallRelayInstruction,
    pub uuid_hash: Option<[u8; 32]>,
}

impl DecodedInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, RecallRelayError> {
        let variant = RecallRelayInstruction::unpack(input)?;
        let uuid_hash = match variant {
            RecallRelayInstruction::InitializeManufacturer
            | RecallRelayInstruction::RegisterProduct => Some(RecallRelayInstruction::uuid_hash(input)?),
            _ => None,
        };
        Ok(Self { variant, uuid_hash })
    }
}

/// Verify that `address` is the PDA for `seeds` under `program_id`.
///
/// Callers derive the bump via `find_program_address` first; matching the
/// resulting address proves the seeds and bump are correct.
pub fn assert_pda(address: &Pubkey, program_id: &Pubkey, seeds: &[&[u8]]) -> bool {
    Pubkey::find_program_address(seeds, program_id).0 == *address
}

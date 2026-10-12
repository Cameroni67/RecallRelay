//! RecallRelay on-chain program.
//!
//! Native `solana-program` implementation. No Anchor. Ownership of registered
//! product units is authoritative on Solana; Supabase holds a materialized
//! view that is reconciled server-side from these accounts.

use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

pub mod error;
pub mod instruction;
pub mod pda;
pub mod processor;
pub mod state;

// Replaced with the deployed program ID.
solana_program::declare_id!("GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP");

entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Fails loudly if this binary's embedded ID ever diverges from the
    // deploy keypair (target/deploy/recallrelay_program-keypair.json).
    assert_eq!(
        *program_id,
        crate::ID,
        "program id mismatch: binary declares {} but was invoked as {}",
        crate::ID,
        program_id
    );

    processor::process_instruction(program_id, accounts, instruction_data)
}

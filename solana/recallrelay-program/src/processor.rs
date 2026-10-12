//! Instruction processor.
//!
//! Account validation is strict: every PDA is re-derived on-chain and compared
//! against the supplied address, so a caller cannot pass an arbitrary account
//! in place of a manufacturer or product.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

use crate::{
    error::RecallRelayError,
    instruction::{assert_pda, DecodedInstruction, RecallRelayInstruction},
    pda::{derive_manufacturer_pda, derive_product_pda, manufacturer_seeds, product_seeds},
    state::{
        Manufacturer, Product, ProductStatus, ACCOUNT_DISCRIMINATOR_MANUFACTURER,
        ACCOUNT_DISCRIMINATOR_PRODUCT, MANUFACTURER_SIZE, PRODUCT_SIZE, STATE_VERSION,
    },
};

/// What the program finds at an account it is about to initialize.
enum ExistingState<T> {
    /// Zero-length data owned by the system program: a genuine first call.
    Uninitialized,
    /// Well-formed RecallRelay state of the expected kind.
    Valid(T),
    /// Anything else: wrong owner, wrong discriminator, short data, or a
    /// version this build does not understand. Never reported as a duplicate.
    Malformed,
}

/// Inspect an account before any `create_account` CPI.
///
/// A duplicate is only a duplicate when the account is already owned by this
/// program *and* decodes as the expected type at the expected version.
fn classify_existing<T, const N: usize>(
    program_id: &Pubkey,
    info: &AccountInfo,
    discriminator: u8,
) -> Result<ExistingState<T>, ProgramError>
where
    T: AccountDecode,
{
    if info.data_is_empty() {
        return Ok(ExistingState::Uninitialized);
    }
    if info.owner != program_id {
        return Ok(ExistingState::Malformed);
    }
    let data = info.try_borrow_data()?;
    if data.len() != N || data[0] != discriminator || data[1] != STATE_VERSION {
        return Ok(ExistingState::Malformed);
    }
    match T::from_bytes(&data) {
        Some(decoded) => Ok(ExistingState::Valid(decoded)),
        None => Ok(ExistingState::Malformed),
    }
}

trait AccountDecode: Sized {
    fn from_bytes(data: &[u8]) -> Option<Self>;
}

impl AccountDecode for Manufacturer {
    fn from_bytes(data: &[u8]) -> Option<Self> {
        Manufacturer::from_bytes(data)
    }
}

impl AccountDecode for Product {
    fn from_bytes(data: &[u8]) -> Option<Self> {
        Product::from_bytes(data)
    }
}

/// Program entrypoint.
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let decoded = DecodedInstruction::unpack(instruction_data)
        .map_err(|e| ProgramError::Custom(e.code()))?;

    match decoded.variant {
        RecallRelayInstruction::InitializeManufacturer => {
            let uuid_hash = decoded.uuid_hash.ok_or(ProgramError::InvalidInstructionData)?;
            process_initialize_manufacturer(program_id, accounts, &uuid_hash)
        }
        RecallRelayInstruction::RegisterProduct => {
            let uuid_hash = decoded.uuid_hash.ok_or(ProgramError::InvalidInstructionData)?;
            process_register_product(program_id, accounts, &uuid_hash)
        }
        RecallRelayInstruction::TransferProduct => process_transfer_product(program_id, accounts),
        RecallRelayInstruction::RetireProduct => process_retire_product(program_id, accounts),
    }
}

fn process_initialize_manufacturer(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    uuid_hash: &[u8; 32],
) -> ProgramResult {
    let iter = &mut accounts.iter();
    let manufacturer_info = next_account_info(iter)?;
    let authority_info = next_account_info(iter)?;
    let system_program = next_account_info(iter)?;

    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !solana_program::system_program::check_id(system_program.key) {
        return Err(ProgramError::IncorrectProgramId);
    }

    let (expected_pda, bump) = derive_manufacturer_pda(program_id, uuid_hash);
    if expected_pda != *manufacturer_info.key {
        msg!("manufacturer PDA mismatch");
        return Err(RecallRelayError::InvalidAccount.into());
    }
    if !assert_pda(manufacturer_info.key, program_id, &manufacturer_seeds(uuid_hash)) {
        return Err(RecallRelayError::InvalidAccount.into());
    }

    match classify_existing::<Manufacturer, { MANUFACTURER_SIZE }>(
        program_id,
        manufacturer_info,
        ACCOUNT_DISCRIMINATOR_MANUFACTURER,
    )? {
        ExistingState::Uninitialized => {}
        ExistingState::Valid(_) => return Err(RecallRelayError::ManufacturerAlreadyInitialized.into()),
        ExistingState::Malformed => return Err(RecallRelayError::InvalidAccountData.into()),
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(MANUFACTURER_SIZE);

    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[b"manufacturer", uuid_hash.as_ref(), &bump_seed];

    invoke_signed(
        &system_instruction::create_account(
            authority_info.key,
            manufacturer_info.key,
            lamports,
            MANUFACTURER_SIZE as u64,
            program_id,
        ),
        &[
            authority_info.clone(),
            manufacturer_info.clone(),
            system_program.clone(),
        ],
        &[seeds],
    )?;

    let slot = solana_program::clock::Clock::get()?.slot;
    let manufacturer = Manufacturer::new(*uuid_hash, *authority_info.key, bump, slot);
    manufacturer_info
        .try_borrow_mut_data()?
        .copy_from_slice(&manufacturer.to_bytes());

    msg!("manufacturer initialized");
    Ok(())
}

fn process_register_product(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    uuid_hash: &[u8; 32],
) -> ProgramResult {
    let iter = &mut accounts.iter();
    let product_info = next_account_info(iter)?;
    let manufacturer_info = next_account_info(iter)?;
    let authority_info = next_account_info(iter)?;
    let owner_info = next_account_info(iter)?;
    let system_program = next_account_info(iter)?;

    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !solana_program::system_program::check_id(system_program.key) {
        return Err(ProgramError::IncorrectProgramId);
    }

    let manufacturer = read_manufacturer(manufacturer_info, program_id)?;
    if manufacturer.authority != *authority_info.key {
        msg!("signer is not the manufacturer authority");
        return Err(RecallRelayError::UnauthorizedManufacturer.into());
    }
    if !manufacturer.is_active {
        msg!("manufacturer is inactive");
        return Err(RecallRelayError::UnauthorizedManufacturer.into());
    }

    let (expected_product, bump) = derive_product_pda(program_id, uuid_hash, manufacturer_info.key);
    if expected_product != *product_info.key {
        msg!("product PDA mismatch");
        return Err(RecallRelayError::InvalidAccount.into());
    }
    if !assert_pda(
        product_info.key,
        program_id,
        &product_seeds(uuid_hash, manufacturer_info.key),
    ) {
        return Err(RecallRelayError::InvalidAccount.into());
    }

    match classify_existing::<Product, { PRODUCT_SIZE }>(
        program_id,
        product_info,
        ACCOUNT_DISCRIMINATOR_PRODUCT,
    )? {
        ExistingState::Uninitialized => {}
        ExistingState::Valid(_) => return Err(RecallRelayError::ProductAlreadyRegistered.into()),
        ExistingState::Malformed => return Err(RecallRelayError::InvalidAccountData.into()),
    }

    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(PRODUCT_SIZE);

    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[
        b"product",
        manufacturer_info.key.as_ref(),
        uuid_hash.as_ref(),
        &bump_seed,
    ];

    invoke_signed(
        &system_instruction::create_account(
            authority_info.key,
            product_info.key,
            lamports,
            PRODUCT_SIZE as u64,
            program_id,
        ),
        &[
            authority_info.clone(),
            product_info.clone(),
            system_program.clone(),
        ],
        &[seeds],
    )?;

    let slot = solana_program::clock::Clock::get()?.slot;
    let product = Product::new(*uuid_hash, *manufacturer_info.key, *owner_info.key, bump, slot);
    product_info
        .try_borrow_mut_data()?
        .copy_from_slice(&product.to_bytes());

    msg!("product registered");
    Ok(())
}

fn process_transfer_product(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let product_info = next_account_info(iter)?;
    let owner_info = next_account_info(iter)?;
    let new_owner_info = next_account_info(iter)?;

    if !owner_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut product = read_product(product_info, program_id)?;

    if product.current_owner != *owner_info.key {
        msg!("signer is not the current owner");
        return Err(RecallRelayError::UnauthorizedOwner.into());
    }
    if product.status != ProductStatus::Active {
        msg!("product is not active");
        return Err(RecallRelayError::ProductInactive.into());
    }
    if product.current_owner == *new_owner_info.key {
        msg!("source and destination owner are the same");
        return Err(RecallRelayError::SameOwner.into());
    }

    product.current_owner = *new_owner_info.key;
    product.transfer_count = product
        .transfer_count
        .checked_add(1)
        .ok_or(ProgramError::InvalidAccountData)?;

    product_info
        .try_borrow_mut_data()?
        .copy_from_slice(&product.to_bytes());

    msg!("product ownership transferred");
    Ok(())
}

fn process_retire_product(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let product_info = next_account_info(iter)?;
    let manufacturer_info = next_account_info(iter)?;
    let authority_info = next_account_info(iter)?;

    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut product = read_product(product_info, program_id)?;
    let manufacturer = read_manufacturer(manufacturer_info, program_id)?;

    if product.manufacturer != *manufacturer_info.key {
        msg!("manufacturer account does not own this product");
        return Err(RecallRelayError::InvalidAccount.into());
    }
    if manufacturer.authority != *authority_info.key {
        msg!("signer is not the manufacturer authority");
        return Err(RecallRelayError::UnauthorizedManufacturer.into());
    }
    if product.status == ProductStatus::Retired {
        return Err(RecallRelayError::ProductInactive.into());
    }

    product.status = ProductStatus::Retired;
    product_info
        .try_borrow_mut_data()?
        .copy_from_slice(&product.to_bytes());

    msg!("product retired");
    Ok(())
}

fn read_manufacturer(info: &AccountInfo, program_id: &Pubkey) -> Result<Manufacturer, ProgramError> {
    if info.owner != program_id {
        return Err(RecallRelayError::InvalidAccountOwner.into());
    }
    Manufacturer::from_bytes(&info.try_borrow_data()?)
        .ok_or_else(|| RecallRelayError::InvalidAccountData.into())
}

fn read_product(info: &AccountInfo, program_id: &Pubkey) -> Result<Product, ProgramError> {
    if info.owner != program_id {
        return Err(RecallRelayError::InvalidAccountOwner.into());
    }
    Product::from_bytes(&info.try_borrow_data()?)
        .ok_or_else(|| RecallRelayError::InvalidAccountData.into())
}

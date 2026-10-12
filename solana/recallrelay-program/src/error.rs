use solana_program::program_error::ProgramError;

/// Errors surfaced by the RecallRelay program.
///
/// Ordering is stable: variants map to explicit discriminants so the
/// TypeScript client can match on the numeric code returned in
/// `ProgramError::Custom`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecallRelayError {
    /// The manufacturer account is already initialized.
    ManufacturerAlreadyInitialized = 0,
    /// The supplied manufacturer authority does not match the stored one.
    UnauthorizedManufacturer = 1,
    /// The product account is already initialized.
    ProductAlreadyRegistered = 2,
    /// The signer is not the current owner of the product.
    UnauthorizedOwner = 3,
    /// A transfer was attempted where source and destination are equal.
    SameOwner = 4,
    /// The product account has been retired and can no longer transfer.
    ProductInactive = 5,
    /// The identifier supplied to a PDA derivation was empty or too long.
    InvalidIdentifier = 6,
    /// A required account was not owned by the expected program.
    InvalidAccountOwner = 7,
    /// An account was passed as the wrong role (e.g. PDA not a PDA).
    InvalidAccount = 8,
    /// Numeric overflow while decoding account data.
    InvalidAccountData = 9,
    /// The instruction discriminant was not recognized.
    InvalidInstruction = 10,
}

impl RecallRelayError {
    /// Numeric code carried inside `ProgramError::Custom`.
    pub fn code(&self) -> u32 {
        *self as u32
    }
}

impl From<RecallRelayError> for ProgramError {
    fn from(e: RecallRelayError) -> Self {
        ProgramError::Custom(e.code())
    }
}

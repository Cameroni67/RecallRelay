// Shared types for the RecallRelay Solana client layer.

/** Account discriminator for a manufacturer PDA. */
export const ACCOUNT_DISCRIMINATOR_MANUFACTURER = 1;

/** Account discriminator for a product PDA. */
export const ACCOUNT_DISCRIMINATOR_PRODUCT = 2;

/** Current on-chain layout version. */
export const STATE_VERSION = 1;

/** Fixed size of a manufacturer account, in bytes. */
export const MANUFACTURER_SIZE = 1 + 1 + 32 + 32 + 1 + 1 + 8;

/** Fixed size of a product account, in bytes. */
export const PRODUCT_SIZE = 1 + 1 + 32 + 32 + 32 + 1 + 4 + 1 + 8;

/** Product lifecycle status. */
export enum ProductStatus {
  Active = 0,
  Retired = 1,
}

/** Instruction discriminants, in wire order. */
export enum RecallRelayInstruction {
  InitializeManufacturer = 0,
  RegisterProduct = 1,
  TransferProduct = 2,
  RetireProduct = 3,
}

/** Stable error codes returned as `ProgramError::Custom`. */
export enum RecallRelayErrorCode {
  ManufacturerAlreadyInitialized = 0,
  UnauthorizedManufacturer = 1,
  ProductAlreadyRegistered = 2,
  UnauthorizedOwner = 3,
  SameOwner = 4,
  ProductInactive = 5,
  InvalidIdentifier = 6,
  InvalidAccountOwner = 7,
  InvalidAccount = 8,
  InvalidAccountData = 9,
  InvalidInstruction = 10,
}

/** Decoded manufacturer account state. */
export interface ManufacturerAccount {
  discriminator: number;
  version: number;
  uuidHash: Uint8Array;
  authority: string;
  isActive: boolean;
  bump: number;
  createdSlot: bigint;
}

/** Decoded product account state. */
export interface ProductAccount {
  discriminator: number;
  version: number;
  uuidHash: Uint8Array;
  manufacturer: string;
  currentOwner: string;
  status: ProductStatus;
  transferCount: number;
  bump: number;
  createdSlot: bigint;
}

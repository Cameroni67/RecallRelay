// Instruction builders and account decoders for the RecallRelay program.

import {
  AccountRole,
  address,
  getAddressDecoder,
  type Address,
  type Instruction,
} from "@solana/kit";
import { PROGRAM_ID } from "./deployment";
import {
  ACCOUNT_DISCRIMINATOR_MANUFACTURER,
  ACCOUNT_DISCRIMINATOR_PRODUCT,
  MANUFACTURER_SIZE,
  PRODUCT_SIZE,
  ProductStatus,
  RecallRelayInstruction,
  type ManufacturerAccount,
  type ProductAccount,
} from "./types";

const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");
const ADDRESS_DECODER = getAddressDecoder();

/** Build an `InitializeManufacturer` instruction. */
export function buildInitializeManufacturerIx(
  manufacturerPda: Address,
  authority: Address,
  uuidHash: Uint8Array,
  programId: Address = address(PROGRAM_ID),
): Instruction {
  return {
    programAddress: programId,
    accounts: [
      { address: manufacturerPda, role: AccountRole.WRITABLE },
      { address: authority, role: AccountRole.READONLY_SIGNER },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data: Buffer.concat([
      Buffer.from([RecallRelayInstruction.InitializeManufacturer]),
      Buffer.from(uuidHash),
    ]),
  };
}

/** Build a `RegisterProduct` instruction. */
export function buildRegisterProductIx(
  productPda: Address,
  manufacturerPda: Address,
  authority: Address,
  owner: Address,
  uuidHash: Uint8Array,
  programId: Address = address(PROGRAM_ID),
): Instruction {
  return {
    programAddress: programId,
    accounts: [
      { address: productPda, role: AccountRole.WRITABLE },
      { address: manufacturerPda, role: AccountRole.READONLY },
      { address: authority, role: AccountRole.READONLY_SIGNER },
      { address: owner, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
    ],
    data: Buffer.concat([
      Buffer.from([RecallRelayInstruction.RegisterProduct]),
      Buffer.from(uuidHash),
    ]),
  };
}

/** Build a `TransferProduct` instruction. */
export function buildTransferProductIx(
  productPda: Address,
  currentOwner: Address,
  newOwner: Address,
  programId: Address = address(PROGRAM_ID),
): Instruction {
  return {
    programAddress: programId,
    accounts: [
      { address: productPda, role: AccountRole.WRITABLE },
      { address: currentOwner, role: AccountRole.READONLY_SIGNER },
      { address: newOwner, role: AccountRole.READONLY },
    ],
    data: Buffer.from([RecallRelayInstruction.TransferProduct]),
  };
}

function bytesToAddress(bytes: Buffer): Address {
  return ADDRESS_DECODER.decode(bytes) as Address;
}

/** Decode a manufacturer account. Returns null if the data is invalid. */
export function decodeManufacturer(data: Buffer): ManufacturerAccount | null {
  if (data.length < MANUFACTURER_SIZE) return null;
  if (data[0] !== ACCOUNT_DISCRIMINATOR_MANUFACTURER) return null;
  const uuidHash = data.subarray(2, 34);
  const authority = bytesToAddress(data.subarray(34, 66));
  const isActive = data[66] !== 0;
  const bump = data[67];
  const createdSlot = data.readBigUInt64LE(68);
  return {
    discriminator: data[0],
    version: data[1],
    uuidHash: new Uint8Array(uuidHash),
    authority,
    isActive,
    bump,
    createdSlot,
  };
}

/** Decode a product account. Returns null if the data is invalid. */
export function decodeProduct(data: Buffer): ProductAccount | null {
  if (data.length < PRODUCT_SIZE) return null;
  if (data[0] !== ACCOUNT_DISCRIMINATOR_PRODUCT) return null;
  const status = data[98];
  if (status !== ProductStatus.Active && status !== ProductStatus.Retired) return null;
  const uuidHash = data.subarray(2, 34);
  const manufacturer = bytesToAddress(data.subarray(34, 66));
  const currentOwner = bytesToAddress(data.subarray(66, 98));
  const transferCount = data.readUInt32LE(99);
  const bump = data[103];
  const createdSlot = data.readBigUInt64LE(104);
  return {
    discriminator: data[0],
    version: data[1],
    uuidHash: new Uint8Array(uuidHash),
    manufacturer,
    currentOwner,
    status,
    transferCount,
    bump,
    createdSlot,
  };
}

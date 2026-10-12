# RecallRelay Solana program build

Program ID: `GjKJEvRqGmP3uoAWWTRYCtRAhFVAnf1MDFKdZoPCR4hP`
Key: `solana/recallrelay-program/program-keypair.json` (root, canonical)

Artifact:
`solana/recallrelay-program/target/deploy/recallrelay_program.so`
size 84520 bytes
sha256 d828db641686d54160a09c979c17e8ab217ef13c96a462081ec90dcbe8ea04a3
embedded pubkey (raw) confirmed present in .so

## Devnet deployment (2026-10-12)

- Cluster: Devnet, owner `BPFLoaderUpgradeab1e11111111111111111111111`
- Deploy transaction: `258gQKddgTJHnnAuj1aJ4vGZNhAGbFV1aCCFRUdm3Libi6hvdyXrW8TbShpQVS7mRRasnVxg63VtAQdUzzvSsaPo`
  (slot 510285095, finalized, `err: null`; sole signature on the ProgramData account)
- ProgramData account: `6G2GvwbrGzphjS8xc8ejrxRXGygkQ6dZfntr5TGAjpgz`
- Upgrade authority: `AbVw7h7MtFEBCQ4bXhVz8AmP2zYtR6TzYAVmZfTnNkov`
- On-chain data length: 84520 bytes — byte-for-byte matches the local artifact above
- Rent held: 0.43024044 SOL

## Live Devnet E2E (2026-10-12)

`npm run e2e:devnet` — headless SIWS identities against a seedless local
Supabase plus real Devnet transactions; 13/13 assertions passed:

- Manufacturer PDA (Northstar Outdoor Tech): `4DcEfmKsekhtaAeaNbrSQcyen2kUfeLL2wFjo5Lpd9CE`
- Product PDA (HeatCore 10K HC10-2048): `2jyGcueZnezt7YUaJU1Aw8DjgnudH4nJqZJw6ovfpa5p`
- Initialize tx: `3Fp8QhTpXtVHutZDX4gG9T6FYQx9wPnbAa8euTXFVFa26S94gfENf8TWQ4HN7KU9xvWFh7fKrGoAfpKjMbeEDwPV`
- Registration tx: `4hyZfZ2USHb1RiEqTEvuyNk3a43P6YzQHuWRc8nKgyhKjUzR2WKXx9PpDP1BE3H74rwexkujWE1GCDorqHxyQz7p`
- Transfer tx (Alice → Bob): `3yjRTicv1THwKvtmfDT37UKZuTjS5SWEfX2i2tkqAYotd5ogLkNmhZjKwtiE8AiFz8RWtUh1f6pAxJ6CbS5VTuhL`

## Toolchain (WSL2 Ubuntu)

rustc 1.99.0
cargo 1.99.0
solana-cli 4.3.0
cargo-build-sbf 4.4.0
platform-tools v1.57 (rustc 1.95.0, target sbpfv3-solana-solana)

Build: `cargo build-sbf` from `solana/recallrelay-program`

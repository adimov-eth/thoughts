# Changelog

## v1.4.1-RC2 (2025-01-04)

Major release implementing the XLN Platform Unified Technical Specification v1.4.1-RC2.

### Breaking Changes

- **Type System Overhaul**: Complete rewrite of core types in `src/core/types.ts`
  - `EntityTx` now includes mandatory `from` field (signer address)
  - New `ServerInput` and `ServerFrame` types for batch processing
  - `Quorum` members can include optional BLS public keys
  
- **Frame Hash Calculation (R-1)**: 
  - Changed from JSON to RLP encoding: `keccak256(rlp(header ‖ txs))`
  - All existing frame hashes are invalid
  - Nodes must wipe state before upgrading
  
- **Transaction Ordering (Y-2)**:
  - Enforced canonical ordering: nonce → from → kind → index
  - Critical for deterministic execution across all nodes

### New Features

- **BLS Signature Recovery**: 
  - Proper cryptographic verification in `signFrame` command
  - Quorum members identified by BLS public key verification
  - Added `verifySync` function for synchronous BLS operations
  
- **Enhanced State Management**:
  - Mempool size limits (MAX_MEMPOOL = 10,000)
  - Nonce overflow protection (max U64)
  - Duplicate nonce detection in mempool
  
- **Property-Based Testing**:
  - Merkle tree determinism tests
  - Quorum weight calculation validation
  - ServerRoot consistency checks

### Improvements

- **Deterministic Encoding**: Replaced JSON.stringify with safe-stable-stringify
- **Error Handling**: Better validation and error messages throughout
- **Performance**: Optimized transaction sorting and state updates
- **Testing**: Comprehensive test coverage for all v1.4.1-RC2 features

### Migration

See [Migration Guide](docs/migration-v1.4.md) for detailed upgrade instructions.

### Contributors

- @adimov-eth - Implementation lead
- Claude (Anthropic) - AI pair programming assistant

---

## v0.4.0-alpha

- **Breaking:** `hashFrame` now uses `@noble/hashes` with a zero-copy hex
  conversion. All previous frame hashes are invalid and devnet nodes must
  wipe state before upgrading.

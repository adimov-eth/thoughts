# Migration Guide: v1.3 to v1.4.1-RC2

This guide helps you migrate from XLN v1.3 to v1.4.1-RC2, which introduces significant architectural improvements and spec compliance updates.

## Overview of Changes

### Breaking Changes

1. **New Type System** (`src/core/types.ts`)
   - Complete rewrite of core types to match v1.4.1-RC2 specification
   - `EntityTx` now includes mandatory `from` field (signer address)
   - New `ServerInput` and `ServerFrame` types for batch processing
   - Quorum members can now include optional BLS public keys

2. **Frame Hash Calculation (R-1 Fix)**
   - Frame hash now computed as `keccak256(rlp(header ‖ txs))`
   - Previous JSON-based hashing replaced with deterministic RLP encoding
   - Affects all frame validation logic

3. **Transaction Ordering (Y-2)**
   - Canonical ordering: nonce → from → kind → index
   - Enforced in all transaction processing
   - Critical for deterministic execution

4. **BLS Signature Verification**
   - Quorum members should now include BLS public keys
   - `signFrame` command performs cryptographic verification
   - Replaces placeholder signer extraction

### New Features

1. **Property-Based Testing**
   - Merkle tree determinism tests
   - Quorum weight calculation tests
   - Frame hash consistency validation

2. **Improved State Management**
   - Mempool size limits (10,000 transactions)
   - Nonce overflow protection (max U64)
   - Duplicate nonce detection in mempool

3. **Enhanced Cryptography**
   - Synchronous BLS verification (`verifySync`)
   - Proper signature recovery in consensus

## Migration Steps

### 1. Update Type Imports

Replace old type imports:

```typescript
// Before
import { EntityTx, Frame } from "../types";

// After
import { EntityTx, Frame } from "../core/types";
```

### 2. Add `from` Field to EntityTx

Update transaction creation:

```typescript
// Before
const tx: EntityTx = {
  kind: "transfer",
  data: { amount: 100n },
  nonce: 1n,
  sig: "0x..."
};

// After
const tx: EntityTx = {
  kind: "transfer",
  data: { amount: 100n },
  nonce: 1n,
  from: signerAddress, // Required field
  sig: "0x..."
};
```

### 3. Update Quorum Definitions

Add BLS public keys for signature verification:

```typescript
// Before
const quorum: Quorum = {
  threshold: 2n,
  members: [
    { address: "0x...", shares: 1n }
  ]
};

// After
const quorum: Quorum = {
  threshold: 2n,
  members: [
    { 
      address: "0x...", 
      shares: 1n,
      pubKey: "0x..." // BLS public key (optional but recommended)
    }
  ]
};
```

### 4. Update Frame Hash Calculations

Replace JSON-based hashing:

```typescript
// Before
const frameHash = keccak256(JSON.stringify({ header, txs }));

// After
import { hashFrame } from "./core/hash";
const frameHash = hashFrame(header, txs);
```

### 5. Handle ServerInput/ServerFrame

New batch processing at server level:

```typescript
// New pattern for server-level processing
const serverInput: ServerInput = {
  inputId: generateId(),
  frameId: currentFrame,
  timestamp: BigInt(Date.now()),
  inputs: [...] // Array of inputs
};

const { next, frame } = applyServerFrame(state, serverInput, () => BigInt(Date.now()));
```

### 6. Update Tests

Key test updates needed:

```typescript
// Ensure replicas are attached
const replica: Replica = {
  attached: true, // Required for command processing
  state: { ... }
};

// Use canonical transaction ordering
const sortedTxs = [...txs].sort(canonicalTxOrder);

// Verify with proper BLS signatures
const sig = await bls.sign(proposalHash, privateKey);
```

## Backwards Compatibility

### Quorum Members Without BLS Keys

The system maintains backwards compatibility for quorum members without BLS public keys:

```typescript
// Members without pubKey field will be skipped during signature verification
const legacyMember = { address: "0x...", shares: 1n };
```

### Migration Path

1. **Phase 1**: Update type imports and add `from` fields
2. **Phase 2**: Implement proper frame hashing
3. **Phase 3**: Add BLS public keys to quorum members
4. **Phase 4**: Update tests and validation logic

## Common Issues and Solutions

### Issue: "EntityTx missing 'from' field"

**Solution**: Ensure all transaction creation includes the `from` field extracted from signature verification.

### Issue: "Frame hash mismatch"

**Solution**: Update to use the new `hashFrame` function with RLP encoding instead of JSON.

### Issue: "BLS signature verification failing"

**Solution**: Ensure quorum members have valid BLS public keys in hex format (with 0x prefix).

### Issue: "Mempool overflow"

**Solution**: Implement mempool size checks (MAX_MEMPOOL = 10,000).

## Testing Your Migration

Run the compliance test suite:

```bash
# Run all tests
bun test

# Run specific compliance tests
bun test reducer.test.ts
bun test property.test.ts
```

Verify key functionality:
- Transaction sorting follows Y-2 rule
- Frame hashes use R-1 calculation
- BLS signatures verify correctly
- State transitions are deterministic

## Resources

- [XLN v1.4.1-RC2 Specification](spec.md)
- [Architecture Overview](architecture.md)
- [API Reference](api.md)
- [GitHub Issues](https://github.com/adimov-eth/thoughts/issues)

For questions or issues during migration, please open an issue on GitHub.

# Architecture

The XLN demo is split into pure state machines and thin adapters.

1. **Server** – routes inputs to replicas and seals `ServerFrame` batches every 100 ms.  
   Source: [`src/core/server.ts`](../src/core/server.ts)
2. **Replica** – signer-specific copy of an Entity running `applyCommand()` FSM.  
   Source: [`src/core/entity.ts`](../src/core/entity.ts)
3. **Entity** – quorum based state machine with Merkle authenticated state.  
   Source: [`src/core/entity.ts`](../src/core/entity.ts)
4. **Codec & Crypto** – helpers for RLP encoding and BLS signatures.  
   Sources: [`src/codec/rlp.ts`](../src/codec/rlp.ts), [`src/crypto/bls.ts`](../src/crypto/bls.ts)
5. **Types** – branded primitives and domain types.  
   Source: [`src/types.ts`](../src/types.ts)

The [`src`](../src) folder contains a minimal chat MVP exercising the consensus and storage flows.

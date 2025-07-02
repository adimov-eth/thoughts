# Architecture

The XLN demo is split into pure state machines and thin adapters.

1. **Server** – routes inputs to replicas and seals `ServerFrame` batches every 100 ms.  
   Source: [`draft/server.ts`](../draft/server.ts)
2. **Replica** – signer-specific copy of an Entity running `applyCommand()` FSM.  
   Source: [`draft/entity.ts`](../draft/entity.ts)
3. **Entity** – quorum based state machine with Merkle authenticated state.  
   Source: [`draft/entity.ts`](../draft/entity.ts)
4. **Codec & Crypto** – helpers for RLP encoding and BLS signatures.  
   Sources: [`draft/codec.ts`](../draft/codec.ts), [`draft/crypto.ts`](../draft/crypto.ts)
5. **Types** – branded primitives and domain types.  
   Source: [`draft/types.ts`](../draft/types.ts)

The [`draft`](../draft) folder contains a minimal chat MVP exercising the consensus and storage flows.

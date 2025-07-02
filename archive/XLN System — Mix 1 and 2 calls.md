
*Extracted from follow-up dialogue*

## System Overview

| Topic | Confirmed Detail | Edge-case / Open Point |
|-------|------------------|------------------------|
| **Roll-out sequence** | **Milestone 1** = "DAO-only" release: entities with quorum governance, on-chain reserves, internal chat; **no channels yet**. Marketed as a safer, lighter alternative to Safe / Aragon. | Channels (cross-entity nets) ship in later milestones. |
| **Early go-to-market targets** | 1. P2P/OTC exchanges ("Binance killer")<br>2. Micro-payments in games & live-stream tipping<br>3. Cross-border salary/remittance rails. | Adoption depends on local **fiat↔XLN** ramps; plan is to license regional *hub* operators (e.g., RU, TH, AE) who act as escrow/bridges. |
| **User story (chat-only prototype)** | • Each message is a Tx (`type:"chat"`).<br>• Txs are bundled into a **Frame** by the current proposer; other signers validate & sign; when signature weight ≥ threshold, proposer broadcasts a **commit**; replicas switch to the new `finalFrame`. | Message ordering now equals order of inclusion; no per-Tx timestamps yet (can be added later). |
| **Command taxonomy (Entity-level)** | `importEntity → addTransactions → proposeFrame → signFrame → commitFrame`. All commands for one server-tick are merged into a single **Input** envelope. | |
| **Input / message routing** | `Input` is addressed to `<entitySigner, entityId>`; server resolves the current proposer and forwards. If sender mis-routes (out-of-date proposer) message stays in local mempool and is retried. | |

## Technical Specifications

### Transaction Shape

```typescript
interface Tx {
  kind: "chat" | ...; 
  data: any;            // e.g. {msg: string}
  nonce: uint64;        // per-signer replay-protection
  sig: bytes64;         // ECDSA; sender recovered from sig
}
```

### Replica State Skeleton

```typescript
interface Replica {
  signerId: uint16;
  entityId: string;
  mempool: Tx[];
  finalFrame: Frame;          // last agreed state
  next: { ts: uint64; tx: Tx[]; state: EntityState };
  sigs: Map<Hash, bytes64[]>; // collected frame signatures
}
```

### Frame Fields

**Recap:** `{height, timestamp, tx[], state}` – `state` now also stores `quorum`.

## Security & Implementation

| Topic | Details |
|-------|---------|
| **Security flow** | Commit = proposer attaches aggregated "hanka" signature to frame and multicasts it; replicas verify, then adopt. |
| **Fiat onboarding gap** | No native escrow yet; current idea: OTC cash ↔ token swap relying on social trust or third-party hubs until jurisdictional channels are live. |
| **Network-effect concern** | Addressed by focusing on niches that **suffer today** (high-fee gaming micro-payments, sanctioned cross-border flows) and by courting "influencer" early adopters instead of mass retail first. |

## Development Shortcuts (Dev Build)

- **Signatures** can be mocked (`sig=0x01…`)
- **Frames** generated in-memory; no sockets needed—scenario files feed Inputs directly
- **Timestamps** can be fixed increments

---

*These points represent the **new** technical facts and edge conditions not covered in the previous distilled summary.*
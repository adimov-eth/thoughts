### XLN Core Design — distilled facts

---

#### 1. Architectural layers

| Layer                                | Responsibility                                                                                     | Key objects                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Server** (single Node .js process) | Stateless event router, groups signer‐slots, builds `ServerBlock`, maintains global height counter | `ServerTx`, `ServerBlock`, mempool                      |
| **Signer slot**                      | Holds each signer’s private replicas of the entities it validates                                  | `Map<entityId, EntityState>`                            |
| **Entity**                           | Quorum‑based state‑machine; own mempool, proposer, block assembly and finalisation                 | `EntityInput`, `EntityTx`, `EntityBlock`, `EntityState` |
| **Account**                          | _Not implemented yet_; disputes/credits will live here later                                       | —                                                       |

---

#### 2. Core data types

```ts
// server‑level
type ServerTx = {
  signerIndex: number; // which signer sends / receives
  entityId: string;
  input: EntityInput; // payload routed into the entity
};

type ServerBlock = {
  height: number; // global counter
  timestamp: number;
  entityInputs: EntityInput[]; // all inputs executed this block (RLP‑encoded)
  stateHash: string; // Merkle root over all signer‑entity snapshots **after** apply
};

// entity‑level
type EntityInput =
  | { kind: "add_tx"; tx: EntityTx }
  | { kind: "propose_block" }
  | { kind: "commit_block"; blockHash: string };

type EntityTx = { op: string; data: any };

type EntityBlock = {
  height: number; // per‑entity counter
  txs: EntityTx[];
  proposer: number; // signer index
  signatures: string[]; // ≥⅔ of quorum (not enforced in MVP)
  hash: string;
};

type EntityState = {
  height: number; // last finalised block
  state: any; // business data
  mempool: EntityTx[]; // un‑blocked txs
  proposed?: EntityBlock; // current draft block awaiting signatures
  quorum: string[]; // signer IDs; quorum[0] == proposer
};

// side‑effects
type OutboxMessage = {
  fromEntity: string;
  toEntity: string;
  toSigner: number; // always the proposer of target entity
  payload: EntityInput;
};
```

All code is written in **pure functional TypeScript** (no classes).

---

#### 3. Processing flow

1. **Ingress** – external actor submits `ServerTx`; server appends it to the mempool (and to a write‑ahead log).
2. **Mempool routing** – each tick, server hands every pending `ServerTx` to the addressed signer replica, which calls `applyEntityInput`.
3. **Entity logic**

   - `add_tx` → push tx into entity mempool.
   - `propose_block` (only proposer) → create draft block from current mempool, store in `state.proposed`, send `OutboxMessage`s to quorum for signatures.
   - `commit_block` → when ≥⅔ signatures collected, apply all txs to state, increment entity height, clear mempool & draft.

4. **Flush** – after all inputs are processed:

   - Build `ServerBlock` (RLP) with executed inputs, compute new `stateHash`, store file `/server_blocks/{height}.rlp`.
   - Write updated entity snapshots to `LevelDB` (`/entity_state/{entityId}`) if snapshot interval reached.
   - Persist WAL entry, then truncate processed part.
   - Convert accumulated `OutboxMessage[]` to new `ServerTx[]`, append to mempool (best‑effort, no ACK).

---

#### 4. Storage layout

| Path                                     | Purpose                                              |
| ---------------------------------------- | ---------------------------------------------------- |
| `entity_state/{entityId}` (LevelDB)      | latest snapshot (`EntityState` RLP)                  |
| `entity_blocks/{entityId}/block_{n}.rlp` | immutable history of that entity                     |
| `server_blocks/{height}.rlp`             | canonical list of `ServerBlock`s                     |
| `history_log/` (LevelDB)                 | write‑ahead log of raw `ServerTx` for crash recovery |

---

#### 5. Consensus & roles

- Every entity has a **quorum list** (signer IDs); element 0 is the **proposer** (director).
- Signers keep **independent replicas**; shared instance is forbidden to preserve consensus simulation.
- Unlimited `EntityInput`s to the same entity may appear in one `ServerBlock`; they execute sequentially.
- Outbox is **fire‑and‑forget**; reliability handled later at channel/account level.
- No global rounds/timeouts in MVP – proposer creates a block immediately after previous block is finalised.

---

#### 6. Snapshots & hashes

- `ServerState.height` is the canonical counter.
- Each flush computes a Merkle root over “signer → entity → RLP snapshot”; stored as `stateHash` in `ServerBlock`.
- Snapshot cadence is configurable (e.g., every _N_ server blocks) to reduce I/O.

---

#### 7. Entity directory

- Public in‑memory map `{ entityId → { quorum[], proposer } }`.
- Synchronised via external gossip; newest signed profile (timestamped, signed by current quorum) replaces older ones.

---

### MVP exclusions

- No signatures/ACL validation, no replay protection beyond height matching.
- No rollbacks, no dead‑entity GC, no account layer, no read‑only RPC.
- Single‑threaded execution; parallelism deferred to future account‑level sharding.

This set of facts fully defines the initial XLN core system required to start coding the functional prototype.

# Persistence & Merkle (spec/03‑storage.md)

## 4.1 Storage duties at a glance

| Duty | File / Column‑family | Trigger |
|------|---------------------|---------|
| WAL (write‑ahead log) | wal/ LevelDB default | every 100 ms tick |
| Mutable KV snapshot | state/ LevelDB CF | every N ServerFrames or ≥ 20 MB delta |
| Immutable CAS blob | cas/ LevelDB CF | on every Entity COMMIT |
| Historic frames | entity_blocks/{id}/block_{n}.rlp | on Entity COMMIT |
| Server frames | server_blocks/{height}.rlp | after each tick |

Dual snapshot model gives fast cold‑start (KV) and audit‑grade history (CAS).

## 4.2 Key‑scheme (dev‑net)

```
<32 B SignerID> ∥ <32 B EntityID> ∥ <32 B StoreType>
```

Flat 96‑byte prefix avoids nested buckets; root lives under the empty key.

## 4.3 WAL → Snapshot flow

```
1. append(ServerFrame) → fsync()
2. if snapshot_due:
       put(stateKV) → fsync()
       deleteOldWalSegments()
```

Crash in the middle replays WAL onto last durable snapshot; idempotent.

## 4.4 Merkle tree rules

| Item | Decision |
|------|----------|
| Arity | Binary for all MVP entities (nibble tree reserved for hubs). |
| Leaf encoding | Canonical RLP of the domain object. |
| Hash | keccak256(left ‖ right) (no length prefix). |
| Proof | [leaf, sibling₁, sibling₂, …, root] – verifier re‑hashes bottom‑up. |

Rules align with Ethereum's state‑trie conventions.

## 4.5 State‑root propagation

1. Entity commits → new Entity root.
2. Server tick ends → Merkle recompute → new Server root (stateHash).
3. stateHash stored in ServerFrame and WAL; optional JL posting gives L1 anchoring.

## 4.6 Recovery procedure

```
load newest snapshot
for block in WAL after snapshot:
    decode(ServerFrame) → replay through core reducer
assert(hash(finalState) == stateHash_in_WAL_tail)
```

If assertion fails, disk is corrupted – node halts.

## 4.7 Compaction & GC

- After 3 successful snapshots call DeleteObsoleteFiles() to trim WAL.
- Entity history older than operator‑defined horizon may be exported to cold storage (IPFS / Glacier).

## 4.8 Reserved future knobs

| Knob | Purpose |
|------|---------|
| --snapshot-bytes | byte‑based snapshot trigger |
| --cas-offload-url | push immutable blobs to S3/IPFS gateway |
| --key-arity | nibble tree for hubs users |
# 04 · Consensus & Messaging

**Goal:** Explain how replicas of an Entity reach finality on a new Entity Frame using the minimal five‑command protocol and how those commands move across the network as Inputs (wire packets).

## 4.1 Actors & objects

| Actor / object | Responsibility | Key fields |
|----------------|----------------|------------|
| Signer | Holds a BLS12‑381 key–pair; originates transactions; votes on frames. | addr, priv, pub |
| Proposer | Designated signer that assembles the next frame and collects sigs. | address |
| Quorum | {threshold, members} – weighted voter set stored in Entity state. | uint threshold; members[address] → {shares, nonce} |
| Hanko | 48‑byte aggregate BLS signature proving collected power ≥ threshold. | hex |
| Frame | Ordered batch of Transaction[] + post‑state snapshot. | height, ts, txs, state |
| Input | Wire envelope {from, to, cmd} that serialises to ServerTx. | cmd one‑of five types (below) |

## 4.2 Command set (wire level)

| Command | Payload fields | Emitted by | Purpose |
|---------|----------------|------------|---------|
| IMPORT | replica (full object) | Operator / bootstrap | Introduce a new Replica into the server's map. |
| ADD_TX | addrKey, tx | Client app / RPC | Inject a user Transaction into the target replica's mempool. |
| PROPOSE | addrKey | Proposer replica | Ask all quorum members to sign the freshly built frame. |
| SIGN | addrKey, signer, frameHash, sig | Non‑proposer replicas | Contribute an individual BLS sig for the proposal. |
| COMMIT | addrKey, hanko, frame | Proposer | Broadcast final frame + aggregate sig once threshold is met. |

All five commands are pure data; they never contain side‑effect callbacks.

## 4.3 Lifecycle in one diagram

```
 ┌──────────────┐
 │  ADD_TX (n)  │   ← client
 └──────┬───────┘
        │ mempool
        ▼
 ┌──────┴───────┐
 │  PROPOSE     │   (proposer, every 100 ms if mempool≠∅)
 └──────┬───────┘
        │ ask‑for‑sig
        ▼
 ┌──────┴───────┐  repeat SIGN until power ≥ threshold
 │   SIGN (m)   │──┐
 └──────┬───────┘  │ sigs accumulate in proposal.sigs
        │          │
      (power < threshold)  ───┐
        │                     │ loop
        ▼                     │
 ┌──────┴───────┐             │
 │  COMMIT      │ ◄───────────┘ power ≥ threshold
 └──────────────┘   Hanko + Frame become final
```

**Time‑outs:** Nothing other than the 100 ms Server tick cadence is required for the chat‑MVP. Future revisions may add proposer rotation on a no‑progress timer.

## 4.4 Detailed flow

### 4.4.1 Transaction ingestion
1. Client signs a Transaction (nonce = current Signer Record nonce).
2. Wrap into ADD_TX → Input → socket.
3. On next tick, server routes to replica; reducer appends to mempool.

### 4.4.2 Proposal

At most one proposal may be live per replica.

```
if (!isAwaitingSignatures && mempool.length > 0):
    frame     = execFrame(last, mempool, ts)
    proposal  = { frame, hash, sigs = { proposer: selfSig } }
    mempool   = []
    isAwaitingSignatures = true
    emit PROPOSE
```

### 4.4.3 Signing
• Replica receives PROPOSE
→ checks frameHash matches local recalculation
→ produces SIG = sign(hash, priv)
→ emits SIGN.
• Proposer collects SIGNs, updates proposal.sigs, checks

```
powerCollected(sigs) ≥ quorum.threshold
```

when true
→ aggregates hanko = aggregate(sigs)
→ emits COMMIT.

### 4.4.4 Commit

Each replica verifies:

```
  hash(frame) == frameHash_in_COMMIT
  verifyAggregate(hanko, hash(frame), quorumPubKeys)
  powerOfSigners(hanko) ≥ threshold          // constant‑time table lookup
```

If all checks pass:

```
last = frame
isAwaitingSignatures = false
proposal = undefined
```

The Entity root hash changes, dirtying the Merkle tree; the server recomputes its Server root at the end of the tick.

## 4.5 Deterministic ordering & nonces

Transactions are sorted nonce → sender → kind before execution.
Duplicate nonce ⇒ reject transaction (deterministic across replicas).
This, combined with JSON‑canonical serialisation, guarantees frame hashes are equal on honest nodes.

## 4.6 Security notes

| Threat | Mitigation |
|--------|------------|
| Forged frame | Aggregate verify (BLS) binds frame hash to the quorum power. |
| Replay old SIGN | Signer Record nonce increases every commit; outdated sig refers to stale frame hash. |
| Censorship by proposer | Any signer may PROPOSE after 100 ms if its own mempool is non‑empty; leader rotation not needed in MVP. |
| State fork | Merkle root embedded in ServerFrame → WAL → snapshot; divergence detectable via root hash mismatch during replay. |

## 4.7 Wire encoding (RLP recipe)

```
Input = rlp.encode([
  from,                   // 20 B
  to,                     // 20 B
  [ cmd.type, json(cmd) ] // command wrapper
])
```

ServerTx is the exact byte string; transport adds a length‑prefix only.

## 4.8 Forward compatibility hooks

| Planned feature | Adjustment needed |
|-----------------|-------------------|
| Weighted proposer rotation | Add NEXT_PROPOSER message or deterministic round‑robin from quorum table. |
| Channel layer | Introduce new TxKind values (credit, debit, open_channel); no protocol change. |
| Fast‑recovery light client | Add SNAPSHOT_REQUEST / RESPONSE Inputs; leaves consensus untouched. |

## 4.9 Reference pseudo‑code (abridged)

```javascript
/* proposer side */
if (Cmd === 'PROPOSE') {
  for (const s of quorum.members) {
    send(Input { from: proposer, to: s, cmd: SIGN_REQ(frame.hash) });
  }
}

if (Cmd === 'SIGN') {
  proposal.sigs[cmd.signer] = cmd.sig;
  if (powerCollected(proposal.sigs) >= quorum.threshold) {
    hanko = aggregate(proposal.sigs.values());
    broadcast(COMMIT(frame, hanko));
  }
}

/* replica side */
if (Cmd === 'COMMIT' && verifyCommit(cmd)) {
  state.last = cmd.frame;
  state.isAwaitingSignatures = false;
  state.proposal = undefined;
}
```

Full implementation lives in `src/entity.ts` and `src/server.ts` (see code skeleton committed earlier).

## 4.10 Test vector (dev‑net, three signers, threshold = 3)
1. Bootstrap replica with quorum {A:2, B:1, C:1}, threshold=3.
2. Send chat Tx from A (nonce 0).
3. Wait 2 ticks → expect:

```
Replica.A.last.height == 1
Replica.B.last.chat   == Replica.C.last.chat
MerleRootA == MerkleRootB == MerkleRootC
ServerRoot  updated
```

Unit‑test is included in `tests/consensus.spec.ts`.

---

**Document compiled:** 2025‑07‑02.
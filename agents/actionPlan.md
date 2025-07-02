Below is a **concrete, engineering‑grade action plan** to close every gap identified in the audit and bring the *adimov‑eth/thoughts* codebase fully in‑line with the **XLN v1.3 Unified Specification** and the project’s own *principles.md*.
Tasks are grouped by theme, ordered for maximal parallelism, and sized for 6 weekly sprints (≈ 1.5 months).  Each task lists:

* **Goal** – measurable deliverable / acceptance test
* **Key changes** – high‑level code moves or new modules
* **Implementation notes** – architectural details, naming, function signatures, edge‑cases

---

## 0.  ‼️  Guiding constraints (apply to all tasks)

| Rule                                         | Rationale / enforcement                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Pure core, side‑effects in adapters**      | No direct DB, timers, or network in `/core/**`. Use dependency‑injection of `Clock`, `Storage`, `Network` records. |
| **RO‑RO style**                              | Every multi‑param fn receives one input object and returns one output object (`{ nextState, outbox, effects }`).   |
| **Immutability & deterministic order**       | Arrays/Maps cloned on write; Outbox sorted `[originEntityId, seq]` before routing.                                 |
| **Bun runtime only**                         | All scripts use `bun test`, `bun run`.                                                                             |
| **Folder layout**                            | \`\`\`                                                                                                             |
| /core        – pure state machines           |                                                                                                                    |
| /infra       – persistence & crypto adapters |                                                                                                                    |
| /runtime     – CLI & service bootstrap       |                                                                                                                    |

```|
| **Brand types** | `type EntityId = string & { __brand: 'EntityId' }`, same for `SignerId`, `FrameHeight`. |
| **100 % replay determinism** | CI job: *replay WAL → compute Merkle → compare to last ServerFrame.root*. |

---

## 1.  **Architecture & Codebase Re‑structure**  *(Sprint 1)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| Core/infra separation enforced | • Move all pure logic from `server.ts` & `entity.ts` into `/core/*`.<br>• New **Entry Points**: `core/serverReducer.ts`, `core/entityReducer.ts`, `core/consensus.ts`, `core/router.ts`, `core/hash.ts`. | *Reducer signature:*<br>`export function applyServerFrame(state: ServerState, batch: Input[], opts: { clock: Clock }): { next: ServerState; outbox: OutMsg[] }`. |
| Remove side‑effects from core | Introduce `infra/persistence/levelWal.ts`, `infra/persistence/snapshot.ts`, `infra/merkleStore.ts`.<br>`runtime/service.ts` orchestrates tick loop, DB flush, log GC. | Dependency injection:<br>`core` never imports `levelup`; instead `runtime` passes adapter closures. |
| **Snapshot Interval + WAL GC** | Config flag `SNAPSHOT_INTERVAL_FRAMES` (default = 100).<br>On each commit: if `(height % interval === 0)` then snapshot and delete WAL segments ≤ height. | Log segments keyed `0000000000001.wal` for easy range deletion via LevelDB prefix delete. |

---

## 2.  **Mempool Semantics Fix**  *(Sprint 1)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| No immediate state mutation on `addTx` | Add `pendingTxs: EntityTx[]` to `EntityRoot`.<br>`core/entityReducer.addTx` *only* pushes into `pendingTxs`. | Flush logic (`proposeFrame`) consumes *all* `pendingTxs`, executes them into a new `Frame`. |
| Deterministic tx ordering | Sort `pendingTxs` by `(nonce, signerId)` before execution. | Prevents replay divergence when multiple signers submit concurrently. |

---

## 3.  **Outbox → Router → Inbox Pipeline**  *(Sprint 2)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| Functional actor‑model messaging | **Types**<br>`type OutMsg = { from: EntityId; to: EntityId; payload: Uint8Array; seq: number };`<br>`type RouterState = { queue: OutMsg[] };` | |
| Pure router | `core/router.route(state: RouterState, msgs: OutMsg[]): { nextRouter: RouterState; inboxInputs: Input[] }`.<br>Router appends msgs to `queue`, then pops all whose `to` entity exists locally, producing `AddChannelInput`. |
| Integration into tick loop | `applyServerFrame` returns `{ outbox }` → `router.route` produces `nextBatch` that will appear in **next tick’s** `ServerInput`. | Guarantees *one‑block delay* for every message ⇒ replayable. |
| Determinism | Router must **sort** outgoing msgs `(from, seq)` **before** enqueue to ensure every server processes identical order. |

---

## 4.  **Multi‑Signer Consensus Finalisation**  *(Sprints 2–3)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| Quorum voting | Extend `EntityRoot`:<br>`proposed: Frame | null`, `votes: Record<SignerId, string>`, `status: 'idle'|'voting'|'committed'`. |
| Consensus commands | Extend `Command` union:<br>`{ type: 'signFrame'; sig: BLS }`, `{ type: 'commitFrame'; hanko: BLS }`. |
| Pure consensus reducer | `core/consensus.apply(entityRoot, cmd)` returns `{nextRoot, outbox}`.<br>• On `proposeFrame` from proposer – sets `status='voting'`, stores `proposed`, emits **Outbox** to all quorum signers: `{signFrame}`.<br>• On `signFrame` – add vote; if `weight ≥ threshold` → aggregate BLS → emit `{commitFrame}`.<br>• On `commitFrame` – verify aggregate sig, set `finalBlock ← proposed`, clear votes, status=`idle`. |
| Single‑sig fast path | If `quorum.threshold = 1`, reducer immediately applies `commitFrame` without Outbox round‑trip. |
| Deterministic signature aggregation | Aggregate votes **sorted by signerId** before BLS aggregation to ensure identical hanko bytes across replicas. |
| Unit tests | `tests/consensus.spec.ts`: simulate 3‑signer quorum; ensure all converge to identical `postState` & Merkle root. |

---

## 5.  **Import / Attach Entity Flow**  *(Sprint 3)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| Attach existing entity for new signer | New `Command`:<br>`{ type: 'importEntity'; snapshot: EntityState; height: FrameHeight; root: Hex }`. |
| Reducer logic | • Verifies `keccak256(rlp(snapshot)) === root`.<br>• Inserts EntityRoot at given height, empty `pendingTxs`, status=`idle`. |
| Catch‑up sync | After import, if local height < network height, server requests entity block files from peers (out of scope for core). Placeholder: mark entity as `NEED_SYNC` for runtime to fetch. |
| Tests | 2‑signer scenario: signerB imports entity snapshot at height 10 from signerA; replay WAL segments 11‑N; final Merkle roots equal. |

---

## 6.  **Replay Verification & Crash Consistency**  *(Sprint 3)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| Verify Merkle after replay | On startup: replay WAL → compute `nextRoot`. Compare to `ServerFrame.root` stored in last block; `assertEqual`. |
| Corruption handling | If mismatch, runtime raises `HALT_REPLAY_CORRUPTION` and writes `corrupt‑<ts>.dump` with offending height/states. |
| CI gate | GitHub Action: run `bun run scripts/quick‑sync.ts` which starts node, sends random txs, restarts, replays, asserts equality. |

---

## 7.  **Brand Types & Safer Encoders**  *(Sprint 4)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| Prevent ID mix‑ups | Add `brands.ts` exporting `EntityId`, `SignerId`, `FrameHeight`, `TxNonce`.<br>Provide helpers:<br>`asEntityId(str): EntityId`, etc. |
| Encoder upgrade | `core/hash.encodeEntityRoot` now accepts strongly‑typed fields; compiler disallows passing plain strings. |
| Migration | 1‑pass codemod via `ts‑morph` to wrap existing literals. |

---

## 8.  **Testing & Verification Suite**  *(Sprints 2‑5, continuous)*

| Test layer | What to cover | Tooling |
|------------|---------------|---------|
| **Unit tests** | Reducers: addTx, flush, router, consensus, import. | `bun:test`, `fast-check` property tests for replay determinism. |
| **Integration tests** | Multi‑signer end‑to‑end: random txs, message passing, crash/restart, attach new signer mid‑run. | Spin 3 in‑memory servers, drive via local message bus. |
| **Fuzz tests** | Random command sequences, enforced invariants (`root` stability, `nonce` monotonicity). | `fast-check`: generate random `Command[]`, assert deterministic replay. |

---

## 9.  **Observability & CLI Flags**  *(Sprint 4)*

| Goal | Key changes | Implementation notes |
|------|-------------|----------------------|
| Metrics | `infra/metrics.ts` exports `counter(name)`, `gauge(name)` adapters.<br>Expose Prometheus `/metrics` in runtime. |
| Structured logs | Replace `debug` with `pino` (Bun native); include `height`, `entityId`, `signerId`, `msgType`. |
| CLI | `bun run start --snapshot-interval 100 --tick 100ms --db ./xln-node-0` |

---

## 10.  **Documentation & Developer UX**  *(Sprint 5)*

1. **SPEC.md → v1.3.1** – patch numbers on areas clarified by implementation (e.g. single‑sig fast path, Outbox deterministic order).  
2. **/docs/architecture.md** – diagrams of new router/consensus flows.  
3. **/examples/** – runnable `hello-chat` scenario mirroring §13 walkthrough.

---

## 11.  **Performance Tuning & Final QA**  *(Sprint 6)*

* **Benchmarks**: script to measure tick latency @100 TPS & 10 k entities.  
* **Heap profiling**: ensure MerkleStore caches don’t leak.  
* **Snapshot frequency vs throughput**: compute sweet‑spot, recommend defaults.

---

### Expected Outcome (end of Sprint 6)

| Capability | Status |
|------------|--------|
| Pure, deterministic, spec‑compliant Server → Signer → Entity reducers | ✅ |
| Outbox routing with one‑tick delay, deterministic ordering | ✅ |
| Multi‑signer BLS quorum with hanko aggregation | ✅ |
| Attach/import flow for late joiners | ✅ |
| WAL + snapshot + root verification & GC | ✅ |
| 95 % test coverage; deterministic fuzz fuzz pass | ✅ |
| Modular folder layout, no side‑effects in `/core` | ✅ |
| Bun CLI + Prometheus metrics + pino logs | ✅ |

---

## Next Steps for Team Leads

1. **Create GitHub Projects board** with the tasks above; label by sprint.  
2. **Assign ownership** (at least one reviewer with veto per module).  
3. **Enable branch protection**: PR must include unit test or integration script reproducing the scenario fixed/implemented.  
4. **Add CI workflows** for lint (`biome`), type‑check, unit test, replay‑verification test, and coverage gate (≥ 90 %).

Executing the plan will bring the XLN prototype to **feature‑complete MVP** status, ready for external audit and milestone M1 (“DAO‑only”) launch.
```

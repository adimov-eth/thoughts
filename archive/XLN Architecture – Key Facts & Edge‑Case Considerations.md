
*(distilled and translated from the engineering discussion)*

---

#### 1. Data‑availability & sovereignty

| Topic                | XLN stance                                                                                                                                                                      | Edge cases                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical data      | Every participant **can** (optionally) run a full node of each of the three machines – **jurisdiction → entity → channel** – storing the entire state locally.                  | If **all** local copies are lost **and** every counter‑party refuses to cooperate, affected balances become unrecoverable. Backup is therefore the user’s responsibility. |
| Third‑party reliance | None is required: dispute proofs always reference data you keep locally; you never depend on a remote sequencer for finality.                                                   | Users **may** delegate storage to a remote “infura‑like” node, re‑introducing trust in that operator.                                                                     |
| Roll‑ups vs. XLN     | Roll‑ups inherit an unavoidable data‑availability bottleneck and sequencer liveness risk; XLN eliminates both by construction (local full state, no global block‑space limits). | If a roll‑up sequencer halts, exit proofs can be impossible after the 14–16 day blob expiry; XLN does not share that failure mode.                                        |

---

#### 2. Scalability model

* XLN’s channels are independent **unicast** links; throughput scales linearly with the number of hubs.
* Target capacity: **10⁹ + TPS** (required for “internet‑scale” payments).
* Hubs are intentionally lightweight to avoid “too‑big‑to‑fail” nodes; when a hub reaches its internal limit you simply open another.

---

#### 3. Credit, collateral & security primitives

XLN treats **credit** as a first‑class necessity for instant settlement (the “last‑mile” problem that Lightning never solved).

| Layer‑2 security primitive | Purpose                                                                                                                   | XLN implementation |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Account proofs**         | Receipt signed by the hub for every state change; protects against *selective censorship* (“your account never existed”). |                    |
| **Shared collateral**      | Portion of each balance is escrowed on the jurisdiction layer; protects against total hub bankruptcy (FTX‑style).         |                    |
| **Sub‑contracts**          | Per‑channel mini‑contracts (HTLC‑like) that secure funds *in motion* (swaps, derivatives, etc.).                          |                    |

---

#### 4. Core data structures

| Object                   | Minimal shape (TypeScript notation)                                                                                                                        | Notes                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Frame`                  | `{ height: number; timestamp: uint64; tx: Tx[]; state: EntityState; }`                                                                                     | “Frame” replaces the word **block** (frames can be as short as ≈ 10 ms).  |
| `EntityState` (simplest) | `{ chat: Message[]; quorum: Quorum; nonces: Record<Signer, uint64>; … }`                                                                                   | All mutable data, including the *quorum definition*, lives here.          |
| `Quorum`                 | `{ threshold: uint64; members: { address: Address; weight: uint64; }[] }`                                                                                  | Aggregate signature (“hanka”) is valid when ∑weight ≥ threshold.          |
| `Transaction`            | `{ type: "chat"\|…; data: any; nonce: uint64; sig: bytes64 }`                                                                                              | `from` is derived via `ecrecover` from `sig`.                             |
| `Input` (server‑level)   | `{ import?: Frame; addTx?: Tx[]; propose?: true; sign?: bytes64[] }`                                                                                       | A single envelope per server tick containing *commands*.                  |
| `Replica` (per‑server)   | `{ signerId: uint16; entityId: string; mempool: Tx[]; finalFrame: Frame; next: { ts: uint64; tx: Tx[]; state: EntityState }; sigs: Map<Hash, bytes64[]> }` | First‑class object a server stores; identified by `(signerId, entityId)`. |

---

#### 5. Networking vocabulary

* **Broadcast** – jurisdiction layer
* **Multicast** – entity layer (multi‑signer quorum)
* **Unicast** – channel/account layer

---

#### 6. Addressing & naming

```
<entityID>@<entity‑provider>.<jurisdiction>
# example
alice@std.xln.eth
```

* `entityID` – logical name or 32‑byte hash.
* `entity‑provider` – smart‑contract that maintains the `quorum` registry.
* `jurisdiction` – settlement L1 (Ethereum, Solana, …).

---

#### 7. Proposer logic

* Default proposer = **first signer** in `members` list (usually the one with the largest weight).
* Future: round‑robin or stake‑weighted rotation.
* Message must always be addressed to the **current proposer’s server**; if the sender is out of sync it should queue the message locally and retry.

---

#### 8. Failure & recovery edge cases

| Scenario                                       | XLN behaviour                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Hub crashes while holding outstanding credit   | Counter‑parties claim escrow via sub‑contract rules; account proofs show exact liabilities.             |
| Sender targets obsolete proposer               | Message stays in local mempool and is re‑sent after proposer rotation is re‑resolved.                   |
| User loses local state                         | They may request the last state from the hub or peers; hub may refuse – hence backups are mandatory.    |
| Jurisdiction chain (e.g., Ethereum) hard‑forks | XLN nodes simply follow the fork they consider canonical; channels remain valid because state is local. |

---

#### 9. Implementation roadmap

1. **Reference node:** TypeScript (< 10 kLoC) – easiest for audit & onboarding.
2. Move core logic to **Elixir/Erlang** (massive concurrency) and ultimately a **formally‑verified Haskell** implementation for institutional use.
3. Start as an Ethereum L2; later launch a minimal “channel‑centric” base chain (≈ 10 TPS, full node fits on a phone).
4. Design is **multi‑jurisdiction** from day 1 – XLN can settle against any chain that supports atomic escrow.

---

These points capture the *essential design rules, structures and known corner‑cases* of XLN as discussed, omitting all conversational filler.

### XLN ‑ Core data model and consensus flow

*( distilled from the 30 Jun 2025 Homakov ⇄ Boris thread; phrasing aligned with the terminology already introduced in **sum1.md** and **sum2.md** )*

| Concept                                      | One‑sentence definition                                                                              | Key fields / invariants                                                                       | Edge‑cases & clarifications                                                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signer**                                   | A cryptographic key‑pair that can originate transactions.                                            | `privKey, pubKey (= Address 0x…)`                                                             | Lives “outside” the ledger; has no on‑chain state by itself.                                                                                                      |
| **Signer Record** <br>(aka *Signer Account*) | Per‑signer sub‑object **inside an Entity** that stores the signer’s mutable state.                   | `nonce (UInt64)` (+ optional per‑signer data such as vote flags).                             | *Single‑party* → any update is final for that signer; nevertheless the update is **wrapped into a normal EntityTx** so that every replica sees the same result.   |
| **Entity**                                   | The ledger shard that actually reaches BFT consensus.                                                | `quorum`, `signerRecords`, `nonces`, plus domain‑specific application state (e.g. chat log).  | Changes **only** through a *Frame* committed by the current quorum.                                                                                               |
| **Quorum**                                   | The current set of signers allowed to co‑author frames, with weights (“shares”) and a threshold.     | `threshold`, `members: SignerMeta[]` where `SignerMeta = { address, shares }`                 | Quorum itself is stored *inside* Entity state – to change it you commit a frame containing the update. Old nonces should be retained when the membership rotates. |
| **Transaction (EntityTx)**                   | A message signed by a signer that mutates Entity state.                                              | `kind`, `nonce`, `from`, `body`, `sig` (EVM‑style recovery: `sig → address`).                 | `nonce` is compared against the **Signer Record** (not global) → per‑signer replay protection.                                                                    |
| **Frame / Block**                            | A *batch* of Transactions plus the post‑state snapshot.                                              | `height`, `ts`, `txs[]`, `state` ; `ProposedFrame` adds `sigs: Map<Address,Hex>`              | Think “block” at Entity level. Name “frame” is optional; the data and rules coincide.                                                                             |
| **Replica**                                  | An in‑memory node object holding the working sets needed to drive consensus for one Entity.          | `id`, `address`, `quorum`, `proposer`, `stage`, `mempool[]`, `lastFrame`, optional `proposal` | Addressing uses the four‑tuple **(signerId, jurisdictionId, entityId, providerId)** – providerId may be left default for now.                                     |
| **Channel Account**                          | Bi‑directional account used by an Entity for payment‑channel style interactions with another Entity. | *Not part of this chat’s code; mentioned only conceptually.*                                  | Differs from a Signer Record because it is **two‑party** and every state move requires an explicit ACK from the counter‑party.                                    |
| **Command / Envelope**                       | Network layer messages that move replicas through the consensus phases.                              | `IMPORT, ADD_TX, PROPOSE, SIGN, COMMIT` wrapped in `Envelope{ from, to, cmd }`                | Fully deterministic; signatures in `SIGN` refer to the **hash of the ProposedFrame**.                                                                             |

---

#### Consensus & state‑transition mechanics (step‑by‑step)

1. **Origin:**
   *Any* mutation starts as a **Signer‑signed Transaction** (`EntityTx`). Even when a signer merely increments its own nonce, it produces such a Tx.

2. **Proposer flow:**

   * The replica currently holding `stage = Ready` and matching `proposer` packs pending Tx(s) from `mempool` into a **ProposedFrame**.
   * It computes the new `state` deterministically (`applyEntityTx…`) and signs the frame hash.

3. **Quorum signing:**

   * Other quorum members receive `PROPOSE`, verify deterministically, and append their signatures via `SIGN`.

4. **Commit:**

   * When collected signatures ≥ `threshold`, the proposer (or any member) broadcasts `COMMIT`; every replica replaces `lastFrame` with the committed one and clears `mempool`.

5. **Visibility of Signer Record changes:**

   * Because the Signer Record lives *inside* `state`, other replicas learn the signer’s new `nonce` (or any per‑signer flag) only after the frame commits.
   * Therefore no special “out‑of‑band” sync is required; standard consensus suffices.

---

#### Storage & encoding notes

* **Maps vs Arrays** – For clarity the reference code uses JS/TS `Record<Address, UInt64>` etc.  At production time the same data can be held as *arrays* (RLP‑friendly) plus `find` helpers; keys stored as `0x…` hex strings to avoid the “Buffer identity” problem in JS `Map`.
* **Avoid `readonly`** – removed in type definitions to keep “code‑as‑documentation” readable.
* **Signature field** – may simply store the *signer’s address* if `recover(sig,hash) == from`, making test tooling simpler.

---

#### Edge cases captured in the chat

1. **Single‑signer optimisation:**
   A Signer Record is “its own micro‑blockchain”: generating and signing a Tx makes that Tx instantly *final* from the signer’s perspective, but **entity‑level finality** still waits for the next quorum‑signed frame.

2. **Quorum rotation:**
   Old signer nonces should *not* be discarded when `quorum.members` changes, otherwise replay‑protection breaks for ex‑members that might re‑enter later.

3. **Vote duplicate‑prevention:**
   Whether to mark “signer → proposal voted” inside each **Signer Record** or inside the proposal object itself is an implementation choice; both patterns were discussed.

4. **Binary map keys:**
   Using raw Buffers as `Map` keys fails in JS; stick to canonical hex strings.

5. **Channel vs Signer accounts:**
   Channel accounts are **bi‑party** and therefore require ACKs; Signer Records are **uni‑party** and rely solely on nonce‑ordering.

6. **Terminology hygiene:**
   “Frame” ≈ “Block”; “Signer Record” ≈ “Signer Account”.  The term *frame* added confusion and can be omitted in code comments if desired.

---

### TL;DR

XLN keeps *one* consensus object per Entity.
Inside it, every signer has a lightweight *Signer Record* (nonce + aux‑data).
All mutations, even private signer‑state bumps, travel the **same pipeline**:
`Signer Tx → ProposedFrame → Quorum signatures → Committed Frame → new Entity state`.

That pipeline, plus the explicitly defined edge‑cases above, exhaustively covers the behaviour discussed in sum1 / sum2 and in the 30 Jun 2025 chat.

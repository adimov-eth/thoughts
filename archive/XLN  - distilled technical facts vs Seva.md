**XLN: distilled technical facts & edge‑case notes (translated to English)**
_(All wording below is factual; every line either defines how the system works or describes an identified corner‑case.)_

---

### 1. Core architecture

| Layer                       | Role                                                                                     | Main data structures                                                                                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jurisdiction Layer (JL)** | Compact L1‐style “root of trust”. Target ≈ 10 TPS so a full node runs on a phone/laptop. | • **Reserves table** – free funds owned by each entity. <br>• **Collateral table** – amounts locked _between_ entity pairs (channels). <br>• Dispute contract (`Depositary.sol`) that can move collateral, mint “debt objects”, and escalate to reserves. |
| **Entity Layer**            | Uniform actors (users, banks, exchanges, dApps). No privilege difference.                | Each entity holds a JL reserve balance and can open any number of channels.                                                                                                                                                                               |
| **Account / Channel Layer** | Bidirectional payment & logic channel between exactly two entities.                      | • **Account Proof**: monotonically‑versioned Merkle object stored by both peers. <br>• **Sub‑contracts**: EVM byte‑code embedded in the proof; run off‑chain, executed on‑chain only if a dispute is raised.                                              |

---

### 2. Channel mechanics

- **Funding** – Any ERC‑20 / 721 / 1155 can be deposited from an EVM chain into `Depositary.sol`. Funds are then re‑tagged as either _reserve_ or _collateral_.
- **Off‑chain flow** – Peers exchange signed `AccountProof` deltas; balances shift instantly and fee‑free.
- **Dispute** – If a peer becomes unresponsive, the other calls `startDispute()`, submits latest proof.

  - After a fixed window (e.g. 24 h) the JL contract:

    - Pays the claimant out of channel collateral.
    - If collateral is insufficient, creates a **debt object** on the counter‑party’s reserve (first‑in‑first‑out enforcement when that reserve is later replenished).

---

### 3. Collateral vs. credit

| Mode                                                                              | Liquidity cost                              | Risk profile                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Fully‑collateralised**                                                          | Capital locked in JL; higher on‑chain cost. | No counter‑party risk; always recoverable via dispute.                                  |
| **Under‑collateralised (credit)**                                                 | Little or no locked capital.                | Exposure to hub/default risk; protected only if insurer/re‑insurer sub‑contract exists. |
| _Users choose any collateral‑to‑credit mix; pricing is left to market discovery._ |                                             |                                                                                         |

---

### 4. Hubs (≃ banks)

- Anyone may act as a hub; success depends on liquidity and reputation, not on licence.
- Periodically (e.g. every few minutes) a hub **re‑balances**: batches all outbound & inbound deltas, touches its reserve once, repays queued debts, refreshes collateral.
- Hub‑and‑spoke topology is intentional: minimal hop‑count, mirrors traditional payment and internet routing models, and avoids the traversal overhead of full mesh.

---

### 5. Programmability

- Every channel may embed **sub‑contracts** in its proof: terse EVM snippets (e.g. a 5‑line constant‑product swap).
- Execution is off‑chain and free; the byte‑code is only replayed on‑chain during a dispute, giving **generalised DeFi without shared global state**.

---

### 6. Scalability & state management

- Off‑chain TPS is unbounded; JL sees traffic only for:

  1. Opening/closing channels (deposit/withdraw),
  2. Periodic hub re‑balances,
  3. Disputes.

- Goal: **global‑scale (≫ 1 M tps) payments** while JL remains phone‑sized and syncs from a snapshot in minutes.
- No **Data‑Availability bottleneck**: each peer already stores the latest account proof; no need to publish every batch on‑chain.

---

### 7. Security guarantees & weaknesses

| Scenario                                | Outcome                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Peer disappears, collateral ≥ claim** | Claimant invokes dispute → funds automatically transferred from collateral to reserve.                                                 |
| **Peer disappears, collateral < claim** | Debt object recorded; claimant paid when debtor’s reserve is next funded or via insurance/re‑insurance channel.                        |
| **Hub exit‑scam**                       | Collateral holders are made whole; credit holders lose up to uncovered amount (unless insured).                                        |
| **Lost device / local state**           | Automatic multi‑server backups of `AccountProof` (Lightning‑style) recommended; otherwise user may lose ability to prove latest state. |
| **JL contract bug**                     | Single systemic risk; corrupt logic undermines all guarantees. Formal verification required.                                           |
| **Throughput spike**                    | Off‑chain unaffected; only JL gas spikes due to more re‑balance calls—mitigated by batching policies.                                  |

---

### 8. Comparative claims vs. existing tech

- **Vs. Lightning** – removes _full‑reserve_ limitation; inbound liquidity not required; supports arbitrary token types and on‑channel EVM logic.
- **Vs. Rollups (optimistic/ZK/Based)**

  - No shared global state → no DA problem, no monolithic sequencer.
  - JL always fits on consumer hardware; rollups’ L1 posting cost & DA proofs scale with usage.
  - Dispute path is simpler (balance math only) instead of re‑executing whole blocks/ZK circuits.

- **Vs. “big‑block” L1s** – avoids state‑growth and validator RAM blow‑ups while still offering sub‑second user‑level latency.

---

### 9. Insurance & cascade safety model

- Any entity may publish an **insurance sub‑contract** referencing another entity’s debt table.
- On dispute resolution, contract auto‑pays unpaid debts up to coverage cap.
- Re‑insurers can insure insurers, forming a cascade similar to traditional deposit insurance schemes.

---

### 10. Deployment roadmap (implied)

1. **Phase 1** – launch XLN as a competitive universal Layer‑2 for all EVM chains; first dApp = ultra‑cheap swap via channel sub‑contract.
2. **Phase 2** – integrate with TradFi: position hubs as modern banks, bridging crypto channels to fiat payment rails.

---

> **Essence:** XLN re‑implements the three‑tier banking model on‑chain.
> _Jurisdiction_ stays tiny; _channels_ do the work; _hubs_ knit the network.
> This yields instant, programmable payments with opt‑in collateral safety and no global‑state choke‑point—at the cost of introducing explicit credit risk, hub reputation economics, and a hard dependency on the correctness of one dispute contract.

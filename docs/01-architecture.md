3  High‑level Architecture Overview (draft §1‑2)

1  Motivation & scope

XLN is a cross‑jurisdictional settlement network that lets entities (DAOs, hubs, users) exchange value and messages instantly off‑chain while anchoring final liability on a minimal on‑chain “Jurisdiction Layer” (JL).  The present document covers the chat‑only MVP‑–the smallest coherent subset that exercises all consensus, storage and replay mechanics without yet touching token channels or hubs.

2  Layered view

┌────────────────────────────────────────────┐
│  External clients (CLI, dApps, bots)       │
└───────────────▲───────────────▲────────────┘
                │ Inputs (UDP/TCP/libp2p)
┌───────────────┴───────────────┴────────────┐
│        **Server (pure core)**              │  100 ms ticks
│  - routes Inputs to Replicas               │
│  - seals Server Frames (WAL)               │
│  - emits Outbox messages for next tick     │
└───────────────▲───────────────▲────────────┘
                │                │ LevelDB adapter
                │                │ (snapshot + CAS)
┌───────────────┴───────────────┴────────────┐
│   **Replica (per signer, per entity)**     │
│  - holds last committed Frame              │
│  - mempool & draft Frame in flight         │
│  - runs `applyCommand()` FSM               │
└───────────────▲───────────────▲────────────┘
                │                │ Merkle tree utils
                │ Entity Inputs  │ (lazy re‑hash)
┌───────────────┴───────────────┴────────────┐
│          **Entity state**                  │
│  - Quorum (weight, threshold)              │
│  - Domain data (chat log for MVP)          │
│  - Merkle root stored in Replica           │
└────────────────────────────────────────────┘

	•	Purity boundary – Everything above the horizontal line executes as a pure function:

(prevServerState, inputBatch) → { nextServerState, outboxBatch }


	•	I/O adapters – Only after the pure step finishes does the outer shell:
	1.	Persist ServerFrame + snapshots to LevelDB (WAL → fsync → snapshot → fsync).
	2.	Transmit outboxBatch over network sockets.

3  Consensus in one paragraph
	1.	Any signer can enqueue an ADD_TX.
	2.	The proposer constructs a Proposed Frame from its mempool and includes its own BLS signature.
	3.	Servers relay SIGN requests; each signer responds with a BLS sig on the frame hash.
	4.	When collected power ≥ threshold the proposer aggregates sigs into one Hanko and multicasts a COMMIT.
	5.	All replicas verify the Hanko, apply the frame, update their Merkle root, and clear isAwaitingSignatures.

4  Persistence strategy

File kind	Written by	Trigger	Purpose
WAL / ServerFrame	Server adapter	every tick	Replay log for crash recovery
Snapshot	Merkle utils	every N frames or 20 MB diff	Fast restart without replaying full WAL
CAS blob	Server adapter	on commit	Immutable audit trail; enables light‑client proofs

Recovery = (latest snapshot) + (WAL segments newer than snapshot) → deterministic state root.

5  Security anchors
	•	Authenticity: each Transaction and Hanko is a BLS signature.
	•	Integrity: every Entity state root is part of the global Merkle root stored in the ServerFrame.
	•	Replay‑protection: signer nonce stored in Signer Record; duplicates are rejected deterministically.
	•	Forensic trace: CAS blobs + WAL provide immutable evidence for any past frame.

6  Road to full XLN
	•	Channel layer: will introduce AccountProof objects under Entity state.
	•	Hubs & credit: hub Entities will keep an order‑book map; collateral enforced on JL.
	•	Anchoring on L1: periodically commit the Server root hash to JL to inherit L1 finality.

⸻



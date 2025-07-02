3 · Core Design Principles  (spec/02‑principles.md)

3.1 Guiding philosophy

Principle	Rationale
Pure functions, no hidden I/O	Every machine exposes exactly (prevState, inputBatch) → {nextState, outbox}. This guarantees bit‑identical replay and enables property‑based testing.  ￼
Fractal interface	Server → Signer‑Replica → Entity → (future) Channel all share the same Input → Outbox contract, easing mental load and code reuse.  ￼
Immutable data, RO‑RO functions	Objects are never mutated in place; reducers return new values. Facilitates time‑travel debugging and state diffing.  ￼
Deterministic ordering	A canonical sort (nonce → sender → kind) is applied before execution, eliminating “works on my machine” races.  ￼

3.2 Layer charter

Layer	Pure?	Responsibility	Key objects
Server	✔︎	Batch Inputs every 100 ms, route to Replicas, seal Server Frame.	Input, ServerFrame  ￼
Replica	✔︎	Hold signer‑specific copy of each Entity, run consensus FSM.	Replica, ProposedFrame
Entity	✔︎	Quorum‑based state machine; finality via Hanko aggregate sig.	EntityState, Frame, Hanko
Adapters	✘	LevelDB, network sockets, wall‑clock.	storage/, transport/

3.3 Consensus skeleton (chat‑MVP)

ADD_TX → PROPOSE → SIGN* → COMMIT

*SIGN may repeat until collected power ≥ threshold. Proposed frame becomes final only after a valid Hanko.  ￼

3.4 Naming & addressing rules
	•	Off‑chain batches are Frames; only JL keeps the word Block.  ￼
	•	Canonical key: jurisdiction:entityId (optionally :signerAddr when indexing replicas).  ￼
	•	External packet = Input; its command field starts with type (enum).  ￼

3.5 Code‑style contract
	•	TypeScript, functional, no classes.  ￼
	•	Brands for primitives (Hex, UInt64) enforce domain correctness at compile time.
	•	One exported apply() per state machine; adapters imported only in IOC shell.
	•	Date.now() never appears inside pure reducers – timestamps injected by caller.

3.6 Extensibility cues

Near‑term	Later
Plug BLS verify into COMMIT.	Channel layer (AccountProof) under Entity.
Parameterise frame cadence per Entity.	Hub order‑book (orderBook KV) for spot swaps.  ￼
CLI flag for mobile LevelDB profile.	Rotation‑proof proposer algorithm (weighted round‑robin).


⸻

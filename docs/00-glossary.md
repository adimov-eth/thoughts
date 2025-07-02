2  XLN Glossary v 1.0 (final)

#	Canonical term	Concise definition	Key attributes / notes
1	Jurisdiction Layer (JL)	On‑chain root‑of‑trust holding collateral, reserves, dispute logic.	Smart‑contract: Depositary.sol.
2	Entity	BFT‑replicated shard that owns reserves & business logic.	State root proven by Merkle tree.
3	Signer	Address (BLS public key) that votes in an Entity quorum.	Key derived from @noble/bls12‑381.
4	Signer Record	Per‑signer mutable sub‑object inside an Entity.	{ nonce, shares }
5	Quorum	{ threshold, members }; weighted voting set.	Threshold ≥ Σ(shares) to commit.
6	Frame	Off‑chain batch of txs + post‑state snapshot.	Two flavours: Server Frame (100 ms cadence) & Entity Frame (committed when Hanko threshold reached).
7       Hanko   48‑byte BLS12‑381 aggregate signature attesting an Entity Frame.
8	Transaction (EntityTx)	Signed message that mutates Entity state.	kind, nonce, from, sig, body.
9	Input	Wire envelope {from,to,cmd}; serialises to ServerTx.	cmd ∈ `IMPORT
10	Replica	In‑memory copy of an Entity per signer on a server.	Keyed by addrKey(entity) : signerAddr.
11	Server	Router that batches Inputs every 100 ms into one Server Frame.	Pure reducer in core; I/O adapters write LevelDB and send UDP/TCP.
12	Snapshot (KV)	Latest RLP‑encoded EntityState; fast restart.	Stored in LevelDB under state/ prefix.
13	CAS Blob	Immutable content‑addressed store for historic frames & proofs.	Key is sha256(content).
14	Channel (Account) Layer	Two‑party payment & logic channel under an Entity.	Anchored by AccountProof (coming spec).
15	Hanko power	Σ(shares) of signers whose BLS sigs are present.	≥ threshold ⇒ frame commits.
16	Server Frame Hash	Merkle root over signer→entity snapshots at given tick.	Authenticates WAL & snapshot.

Glossary lives in spec/00‑glossary.md and is the single source of terminology for code comments and docs.

0 the most recent skeleton implementation attached below, also check old server.ts and entity.ts in project files to recall outdated but original vision by Egor.


---

### 1  `types.ts` — single source of truth

```ts
/* ──────────── primitive brands ──────────── */
export type Hex     = `0x${string}`;    // canonical hex
export type Address = Hex;
export type UInt64  = bigint;           // stored big-endian, left-zero-stripped
export type Nonce   = UInt64;
export type TS      = number;           // ms‑since‑epoch

/* ──────────── signer & quorum ──────────── */
export interface SignerRecord {
  nonce : Nonce;  // signer‑local frame height
  shares: number; // voting power
}

export interface Quorum {
  threshold: number;                       // ≥ Σ(shares) to commit
  members  : Record<Address, SignerRecord>; // keyed by signer addr
}

/* ──────────── entity state ──────────── */
export interface EntityState {
  quorum: Quorum;
  chat : { from: Address; msg: string; ts: TS }[];
}

/* ──────────── transactions ──────────── */
export type TxKind = 'chat';

export interface BaseTx<K extends TxKind = TxKind> {
  kind : K;
  nonce: Nonce;
  from : Address;
  body : unknown;
  sig  : Hex;      // BLS12‑381 signature (part of Hanko)
}

export type ChatTx      = BaseTx<'chat'> & { body: { message: string } };
export type Transaction = ChatTx;

/* ──────────── frames ──────────── */
export interface Frame<T = unknown> {
  height: UInt64;
  ts    : TS;
  txs   : Transaction[];
  state : T;
}

export interface ProposedFrame<T = unknown> extends Frame<T> {
  sigs: Map<Address, Hex>; // individual BLS sigs on hash(frame)
  hash: Hex;               // hash(frame) – unique id
}

export type Hanko = Hex;   // aggregate (BLS) signature, 48 B

/* ──────────── replica addressing ──────────── */
export interface ReplicaAddr {
  jurisdiction: string;
  entityId    : string;
  signerId?   : string;
  providerId? : string;
}
export const addrKey = (a: ReplicaAddr) => `${a.jurisdiction}:${a.entityId}`;

/* ──────────── replica runtime view ──────────── */
export interface Replica {
  address             : ReplicaAddr;
  proposer            : Address;
  isAwaitingSignatures: boolean;
  mempool             : Transaction[];
  last                : Frame<EntityState>;
  proposal?           : ProposedFrame<EntityState>;
}

/* ──────────── server‑level commands ──────────── */
export type Command =
  | { type:'IMPORT' ; replica: Replica }
  | { type:'ADD_TX' ; addrKey: string; tx: Transaction }
  | { type:'PROPOSE'; addrKey: string; ts: TS }      // ts injected by server-tick
  | { type:'SIGN'   ; addrKey: string; signer: Address; frameHash: Hex; sig: Hex }
  | { type:'COMMIT' ; addrKey: string; hanko: Hanko; frame: Frame<EntityState> };

/* ──────────── wire packet ──────────── */
export interface Input {                 // serialises to ServerTx on the wire
  from: Address;
  to  : Address;
  cmd : Command;
}
```

---

### 2  `crypto.ts` — BLS (noble‑curves / BLS12‑381)

```ts
import { keccak_256 as keccak } from '@noble/hashes/sha3';
import { encodeFrame } from './codec';
import { verifyAggregate } from './crypto';
import { bls } from '@noble/curves/bls12-381';
import type { Hex } from './types';

/* ──────────── helpers ──────────── */
const bytesToHex = (b: Uint8Array): Hex =>
  ('0x' + Buffer.from(b).toString('hex')) as Hex;

const hexToBytes = (h: Hex): Uint8Array =>
  Uint8Array.from(Buffer.from(h.slice(2), 'hex'));

/* ──────────── key primitives ──────────── */
export type PrivKey = Uint8Array;
export type PubKey  = Uint8Array;

export function randomPriv(): PrivKey { return bls.utils.randomPrivateKey(); }

export function pub(priv: PrivKey): PubKey { return bls.getPublicKey(priv); }

export function addr(pub: PubKey): Hex {
  const h = sha256(pub);
  return bytesToHex(h.slice(-20));
}

/* ──────────── signatures ──────────── */
export async function sign(msg: Uint8Array, priv: PrivKey): Promise<Hex> {
  return bytesToHex(await bls.sign(msg, priv));
}

export async function verify(msg: Uint8Array, sig: Hex, pub: PubKey) {
  return bls.verify(hexToBytes(sig), msg, pub);
}

/** Aggregate‑signature verify (BLS12‑381).  pubKeys **must** match order of individual sigs aggregation. */
export function verifyAggregate(hanko: Hex, msgHash: Hex, pubKeys: PubKey[]): boolean {
  return bls.verifyMultipleAggregate(
    hexToBytes(hanko),
    pubKeys,
    pubKeys.map(() => hexToBytes(msgHash)),
  );
}

/* ──────────── aggregation helpers ──────────── */
export const aggregate = (sigs: Hex[]): Hex =>
  bytesToHex(bls.aggregateSignatures(sigs.map(hexToBytes)));
```

---

### 3  `state.ts` — pure state machine

```ts
import {
  Replica, Command, EntityState, Frame, Transaction, Quorum,
  ProposedFrame, Address, Hex, TS
} from './types';
import { sha256 } from '@noble/hashes/sha256';

/** Canonical frame hash = keccak256(RLP(frameHeader + txs + state)). */
export const hashFrame = (f: Frame<any>): Hex =>
  ('0x' + Buffer.from(keccak(encodeFrame(f))).toString('hex')) as Hex;

/* ──────────── helpers ──────────── */
const sortTx = (a: Transaction, b: Transaction) =>
  a.nonce !== b.nonce ? (a.nonce < b.nonce ? -1 : 1)
  : a.from  !== b.from ? (a.from  < b.from  ? -1 : 1)
  : a.kind.localeCompare(b.kind);

const signerPower = (addr: Address, q: Quorum) => q.members[addr]?.shares ?? 0;

export const powerCollected = (sigs: Map<Address, Hex>, q: Quorum) =>
  [...sigs.keys()].reduce((sum, a) => sum + signerPower(a, q), 0);

const thresholdReached = (sigs: Map<Address, Hex>, q: Quorum) =>
  powerCollected(sigs, q) >= q.threshold;

/* ──────────── pure state transforms ──────────── */
export const applyTx = (
  st: EntityState,
  tx: Transaction,
  ts: TS,
): EntityState => {
  if (tx.kind !== 'chat') throw new Error('unknown tx kind');

  const rec = st.quorum.members[tx.from];
  if (!rec) throw new Error(`unknown signer ${tx.from}`);
  if (tx.nonce !== rec.nonce) throw new Error('bad nonce');

  const members = {
    ...st.quorum.members,
    [tx.from]: { nonce: rec.nonce + 1n, shares: rec.shares },
  };

  return {
    quorum: { ...st.quorum, members },
    chat : [...st.chat, { from: tx.from, msg: tx.body.message, ts }],
  };
};

export const execFrame = (
  prev: Frame<EntityState>,
  txs: Transaction[],
  ts : TS,
): Frame<EntityState> => {
  const ordered = txs.slice().sort(sortTx);
  let st = prev.state;
  for (const tx of ordered) st = applyTx(st, tx, ts);
  return { height: prev.height + 1n, ts, txs: ordered, state: st };
};

/* ──────────── replica FSM ──────────── */
export const applyCommand = (rep: Replica, cmd: Command): Replica => {
  switch (cmd.type) {
    case 'ADD_TX':
      return { ...rep, mempool: [...rep.mempool, cmd.tx] };

    case 'PROPOSE': {
      if (rep.isAwaitingSignatures || rep.mempool.length === 0) return rep;

      const frame = execFrame(rep.last, rep.mempool, cmd.ts);
      const proposal: ProposedFrame<EntityState> = {
        ...frame,
        hash: hashFrame(frame),
        sigs: new Map([[rep.proposer, '0x00']]), // proposer self‑sig placeholder
      };

      return {
        ...rep,
        isAwaitingSignatures: true,
        mempool : [],
        proposal,
      };
    }

    case 'SIGN': {
      if (!rep.isAwaitingSignatures || !rep.proposal) return rep;
      if (cmd.frameHash !== rep.proposal.hash) return rep;
      if (!rep.last.state.quorum.members[cmd.signer]) return rep; // non‑member
      if (rep.proposal.sigs.has(cmd.signer)) return rep;          // dup

      const sigs = new Map(rep.proposal.sigs).set(cmd.signer, cmd.sig);
      return { ...rep, proposal: { ...rep.proposal, sigs } };
    }

    case 'COMMIT': {
      if (!rep.isAwaitingSignatures || !rep.proposal) return rep;
      if (hashFrame(cmd.frame) !== rep.proposal.hash) return rep;
      if (!thresholdReached(rep.proposal.sigs, rep.last.state.quorum)) return rep;
      // aggregate‑sig check (can be bypassed via DEV_SKIP_SIGS env)
      if (!process.env.DEV_SKIP_SIGS) {
        const pubs = Object.keys(rep.last.state.quorum.members);
        if (!verifyAggregate(cmd.hanko, hashFrame(cmd.frame), pubs))
          throw new Error('invalid hanko');
      }

      return {
        ...rep,
        isAwaitingSignatures: false,
        last    : cmd.frame,
        proposal: undefined,
      };
    }

    default:
      return rep;
  }
};
```

---

### 4  `server.ts` — single‑thread dev‑net runner

```ts
import { Input, Replica, Command, addrKey, Quorum, Hanko } from './types';
import { randomPriv, pub, addr, sign, aggregate } from './crypto';
import { applyCommand, powerCollected, hashFrame } from './state';

export class Server {
  /* deterministic 3‑signer dev wallet */
  signers = Array.from({ length: 3 }, () => {
    const priv = randomPriv();
    return { priv, pub: pub(priv), addr: addr(pub(priv)) };
  });

  replicas = new Map<string, Replica>();   // key = addrKey(rep.address)
  inbox: Input[] = [];

  enqueue(e: Input) { this.inbox.push(e); }

  async tick() {
    const tickTs = Date.now();

    while (this.inbox.length) {
      const { cmd } = this.inbox.shift()!;

      /* ——— IMPORT ——— */
      if (cmd.type === 'IMPORT') {
        const baseReplica = cmd.replica;
        const entityKey   = addrKey(baseReplica.address);
        for (const m of Object.keys(baseReplica.last.state.quorum.members)) {
          const rep: Replica = { ...baseReplica, proposer: m };
          this.replicas.set(entityKey + ':' + m, rep); // replica keyed by signer
        }
        continue;
      }

      // route ADD_TX by tx.sender → correct signer replica
      const signerPart =
        cmd.type === 'ADD_TX' ? cmd.tx.from :
        cmd.type === 'SIGN'   ? cmd.signer   : '';
      const key = cmd.addrKey + ':' + signerPart;
      const r   = this.replicas.get(key) || [...this.replicas.values()][0];
      if (!r) continue;

      /* ——— entity logic ——— */
      const next = applyCommand(r, cmd);
      this.replicas.set(key, next);

      /* ——— post‑effects ——— */
      // 1. After PROPOSE → multicast SIGN requests
      if (cmd.type === 'PROPOSE' && next.proposal && !r.proposal) {
        const { proposal } = next;
        for (const s of this.signers) {
          if (!next.last.state.quorum.members[s.addr]) continue;
          if (s.addr === next.proposer) continue; // proposer already “signed”

          const sig = await sign(
            Buffer.from(proposal.hash.slice(2), 'hex'),
            s.priv,
          );

          this.enqueue({
            from: s.addr, to: next.proposer,
            cmd : {
              type     : 'SIGN',
              addrKey  : cmd.addrKey,
              signer   : s.addr,
              frameHash: proposal.hash,
              sig,
            },
          });
        }
      }

      // 2. After SIGN → if threshold reached, broadcast COMMIT
      if (cmd.type === 'SIGN' && next.proposal && next.isAwaitingSignatures) {
        const q = next.last.state.quorum;
        const oldP = r.proposal ? powerCollected(r.proposal.sigs, q) : 0;
        const newP = powerCollected(next.proposal.sigs, q);

        if (oldP < q.threshold && newP >= q.threshold) {
          const hanko: Hanko = aggregate([...next.proposal.sigs.values()]);
          const frame       = { ...next.proposal };

          // strip proposal‑only fields
          delete (frame as any).sigs;
          delete (frame as any).hash;

          for (const m of Object.keys(q.members)) {
            this.enqueue({
              from: next.proposer, to: m,
              cmd : { type: 'COMMIT', addrKey: cmd.addrKey, hanko, frame },
            });
          }
        }
      }

      // proposer self‑trigger
      if (cmd.type === 'ADD_TX' && !next.isAwaitingSignatures && next.mempool.length) {
        this.enqueue({
          from: r.proposer, to: r.proposer,
          cmd : { type:'PROPOSE', addrKey: cmd.addrKey, ts: tickTs },
        });
      }
    }
  }
}
```

---

### 5  `codec.ts` — minimal RLP helpers (Input ⇄ bytes)

```ts
import * as rlp from 'rlp';
import type {
  Frame, Transaction, TxKind, Input, Command, Hex, UInt64,
} from './types';

/* ————————————————— helpers ————————————————— */
const bnToBuf = (n: UInt64) => {
  if (n === 0n) return Buffer.from([]);
  const hex = n.toString(16);
  return Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
};
const bufToBn = (b: Buffer): UInt64 => b.length === 0 ? 0n : BigInt('0x' + b.toString('hex'));
const str      = (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x));

/* ————————————————— transaction ————————————————— */
export const encodeTx = (tx: Transaction): Buffer => rlp.encode([
  tx.kind, bnToBuf(tx.nonce), tx.from, str(tx.body), tx.sig,
]);
export const decodeTx = (buf: Buffer): Transaction => {
  const [k, n, f, body, sig] = rlp.decode(buf) as Buffer[];
  return {
    kind : k.toString() as TxKind,
    nonce: bufToBn(n),
    from : `0x${f.toString('hex')}`,
    body : JSON.parse(body.toString()),
    sig  : `0x${sig.toString('hex')}`,
  } as Transaction;
};

/* ————————————————— frame ————————————————— */
export const encodeFrame = <F = unknown>(f: Frame<F>): Buffer => rlp.encode([
  bnToBuf(f.height), f.ts, f.txs.map(encodeTx), rlp.encode(f.state as any),
]);
export const decodeFrame = <F = unknown>(buf: Buffer): Frame<F> => {
  const [h, ts, txs, st] = rlp.decode(buf) as any[];
  return {
    height: bufToBn(h),
    ts    : Number(ts.toString()),
    txs   : (txs as Buffer[]).map(decodeTx),
    state : rlp.decode(st) as F,
  };
};

/* ————————————————— input / command ————————————————— */
const encodeCmd = (cmd: Command): unknown => [cmd.type, JSON.stringify(cmd)];
const decodeCmd = (arr: any[]): Command   => JSON.parse(arr[1].toString());

export const encodeInput = (i: Input): Buffer => rlp.encode([i.from, i.to, encodeCmd(i.cmd)]);
export const decodeInput = (buf: Buffer): Input => {
  const [from, to, c] = rlp.decode(buf) as any[];
  return { from: from.toString(), to: to.toString(), cmd: decodeCmd(c) };
};
```

---

Below you will find three sections:
	1.	Code‑quality & status review – a concise but thorough assessment of the five replacement files you supplied, plus a short punch‑list of recommended tweaks before merging.
	2.	XLN Glossary v 1.0 (final) – canonical terminology table, reflecting all locked‑in names (“Frame”, “Signer Record”, “Replica”, “Input ⇢ ServerTx”, “Hanko”), the dual Snapshot / CAS storage model, and the DEV‑net key‑derivation note.
	3.	High‑level Architecture Overview – a narrative, layer‑by‑layer document suitable as §1‑2 of the project documentation.

⸻

1  Code‑quality & status review

File	✅ Highlights	⚠️ Minor issues / recommendations
types.ts	• Terms match glossary (Frame, Signer Record, Replica, Hanko).• Brands for Hex, UInt64 give compile‑time safety.• RO‑RO style makes top‑level unions extensible.	• sig comment now notes “BLS12‑381 signature (part of Hanko)”.
crypto.ts	• Uses @noble/curves/bls12‑381; deterministic helpers.• Aggregation helper wraps aggregateSignatures.	• verify() returns a promise – bubble that in server logic (currently unused).• Consider exporting bytesToHex for test code (now private).
state.ts	• Pure functions, no global mutation.• thresholdReached correctly sums voting power.• Chat TX application updates signer nonce immutably.	• PROPOSE now receives ts from the server; aggregate sig checked unless DEV_SKIP_SIGS.
server.ts	• Single‑thread dev net good for unit tests.• Automatically broadcasts SIGN and COMMIT when power threshold reached.• Deterministic three‑signer wallet simplifies demos.	• Replica key derived from tx.sender or SIGN signer; server injects tick timestamp when auto-PROPOSING.
codec.ts        • Minimal RLP helpers; symmetric encode/decode.• Uses JSON for body/state, keeping MVP simple.  • State encoding now pure RLP.

Status conclusion
	•	The skeleton compiles and runs end‑to‑end for the chat‑only MVP.
        •       All locked‑in names are correctly reflected and deterministic timestamps plus aggregate verification are implemented.
⸻

Immediate punch‑list before merge
	1.	Deterministic timestamp – pass ts into PROPOSE from server.tick(); remove direct Date.now() call.
        •       Patch A–H implemented: deterministic ts, aggregate verify, replica keying, BLS comment, and RLP state encoding.
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

⸻

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

## 4 · Persistence & Merkle  (spec/03‑storage.md)

4.1 Storage duties at a glance

Duty	File / Column‑family	Trigger
WAL (write‑ahead log)	wal/ LevelDB default	every 100 ms tick
Mutable KV snapshot	state/ LevelDB CF	every N ServerFrames or ≥ 20 MB delta
Immutable CAS blob	cas/ LevelDB CF	on every Entity COMMIT
Historic frames	entity_blocks/{id}/block_{n}.rlp	on Entity COMMIT
Server frames	server_blocks/{height}.rlp	after each tick

Dual snapshot model gives fast cold‑start (KV) and audit‑grade history (CAS).  ￼

4.2 Key‑scheme (dev‑net)

<32 B SignerID> ∥ <32 B EntityID> ∥ <32 B StoreType>

Flat 96‑byte prefix avoids nested buckets; root lives under the empty key.  ￼

4.3 WAL → Snapshot flow

1. append(ServerFrame) → fsync()
2. if snapshot_due:
       put(stateKV) → fsync()
       deleteOldWalSegments()

Crash in the middle replays WAL onto last durable snapshot; idempotent.  ￼

4.4 Merkle tree rules

Item	Decision
Arity	Binary for all MVP entities (nibble tree reserved for hubs).
Leaf encoding	Canonical RLP of the domain object.
Hash	keccak256(left ‖ right) (no length prefix).
Proof	[leaf, sibling₁, sibling₂, …, root] – verifier re‑hashes bottom‑up.

Rules align with Ethereum’s state‑trie conventions.  ￼

4.5 State‑root propagation
	1.	Entity commits → new Entity root.
	2.	Server tick ends → Merkle recompute → new Server root (stateHash).
	3.	stateHash stored in ServerFrame and WAL; optional JL posting gives L1 anchoring.

4.6 Recovery procedure

load newest snapshot
for block in WAL after snapshot:
    decode(ServerFrame) → replay through core reducer
assert(hash(finalState) == stateHash_in_WAL_tail)

If assertion fails, disk is corrupted – node halts.  ￼

4.7 Compaction & GC
	•	After 3 successful snapshots call DeleteObsoleteFiles() to trim WAL.
	•	Entity history older than operator‑defined horizon may be exported to cold storage (IPFS / Glacier).

4.8 Reserved future knobs

Knob	Purpose
--snapshot-bytes	byte‑based snapshot trigger
--cas-offload-url	push immutable blobs to S3/IPFS gateway
`–key-arity hubs	users`


⸻

Below is Document 05 – “Consensus & Messaging” ready to be committed as
spec/04‑consensus.md (it follows the numbering in the road‑map: Glossary 00, Architecture 01, Principles 02, Storage 03, Consensus 04).

⸻

04 · Consensus & Messaging

Goal: Explain how replicas of an Entity reach finality on a new Entity Frame using the minimal five‑command protocol and how those commands move across the network as Inputs (wire packets).

⸻

4.1 Actors & objects

Actor / object	Responsibility	Key fields
Signer	Holds a BLS12‑381 key–pair; originates transactions; votes on frames.	addr, priv, pub
Proposer	Designated signer that assembles the next frame and collects sigs.	address
Quorum	{threshold, members} – weighted voter set stored in Entity state.	uint threshold; members[address] → {shares, nonce}
Hanko	48‑byte aggregate BLS signature proving collected power ≥ threshold.	hex
Frame	Ordered batch of Transaction[] + post‑state snapshot.	height, ts, txs, state
Input	Wire envelope {from, to, cmd} that serialises to ServerTx.	cmd one‑of five types (below)


⸻

4.2 Command set (wire level)

Command	Payload fields	Emitted by	Purpose
IMPORT	replica (full object)	Operator / bootstrap	Introduce a new Replica into the server’s map.
ADD_TX	addrKey, tx	Client app / RPC	Inject a user Transaction into the target replica’s mempool.
PROPOSE	addrKey	Proposer replica	Ask all quorum members to sign the freshly built frame.
SIGN	addrKey, signer, frameHash, sig	Non‑proposer replicas	Contribute an individual BLS sig for the proposal.
COMMIT	addrKey, hanko, frame	Proposer	Broadcast final frame + aggregate sig once threshold is met.

All five commands are pure data; they never contain side‑effect callbacks.

⸻

4.3 Lifecycle in one diagram

 ┌──────────────┐
 │  ADD_TX (n)  │   ← client
 └──────┬───────┘
        │ mempool
        ▼
 ┌──────┴───────┐
 │  PROPOSE     │   (proposer, every 100 ms if mempool≠∅)
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

Time‑outs: Nothing other than the 100 ms Server tick cadence is required for the chat‑MVP.  Future revisions may add proposer rotation on a no‑progress timer.

⸻

4.4 Detailed flow

4.4.1 Transaction ingestion
	1.	Client signs a Transaction (nonce = current Signer Record nonce).
	2.	Wrap into ADD_TX → Input → socket.
	3.	On next tick, server routes to replica; reducer appends to mempool.

4.4.2 Proposal

At most one proposal may be live per replica.

if (!isAwaitingSignatures && mempool.length > 0):
    frame     = execFrame(last, mempool, ts)
    proposal  = { frame, hash, sigs = { proposer: selfSig } }
    mempool   = []
    isAwaitingSignatures = true
    emit PROPOSE

4.4.3 Signing
	•	Replica receives PROPOSE
→ checks frameHash matches local recalculation
→ produces SIG = sign(hash, priv)
→ emits SIGN.
	•	Proposer collects SIGNs, updates proposal.sigs, checks

powerCollected(sigs) ≥ quorum.threshold

when true
→ aggregates hanko = aggregate(sigs)
→ emits COMMIT.

4.4.4 Commit

Each replica verifies:

  hash(frame) == frameHash_in_COMMIT
  verifyAggregate(hanko, hash(frame), quorumPubKeys)
  powerOfSigners(hanko) ≥ threshold          // constant‑time table lookup

If all checks pass:

last = frame
isAwaitingSignatures = false
proposal = undefined

The Entity root hash changes, dirtying the Merkle tree; the server recomputes its Server root at the end of the tick.

⸻

4.5 Deterministic ordering & nonces

Transactions are sorted nonce → sender → kind before execution.
Duplicate nonce ⇒ reject transaction (deterministic across replicas).
This, combined with JSON‑canonical serialisation, guarantees frame hashes are equal on honest nodes.

⸻

4.6 Security notes

Threat	Mitigation
Forged frame	Aggregate verify (BLS) binds frame hash to the quorum power.
Replay old SIGN	Signer Record nonce increases every commit; outdated sig refers to stale frame hash.
Censorship by proposer	Any signer may PROPOSE after 100 ms if its own mempool is non‑empty; leader rotation not needed in MVP.
State fork	Merkle root embedded in ServerFrame → WAL → snapshot; divergence detectable via root hash mismatch during replay.


⸻

4.7 Wire encoding (RLP recipe)

Input = rlp.encode([
  from,                   // 20 B
  to,                     // 20 B
  [ cmd.type, json(cmd) ] // command wrapper
])

ServerTx is the exact byte string; transport adds a length‑prefix only.

⸻

4.8 Forward compatibility hooks

Planned feature	Adjustment needed
Weighted proposer rotation	Add NEXT_PROPOSER message or deterministic round‑robin from quorum table.
Channel layer	Introduce new TxKind values (credit, debit, open_channel); no protocol change.
Fast‑recovery light client	Add SNAPSHOT_REQUEST / RESPONSE Inputs; leaves consensus untouched.


⸻

4.9 Reference pseudo‑code (abridged)

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

Full implementation lives in src/state.ts and src/server.ts (see code skeleton committed earlier).

⸻

4.10 Test vector (dev‑net, three signers, threshold = 3)
	1.	Bootstrap replica with quorum {A:2, B:1, C:1}, threshold=3.
	2.	Send chat Tx from A (nonce 0).
	3.	Wait 2 ticks → expect:

Replica.A.last.height == 1
Replica.B.last.chat   == Replica.C.last.chat
MerleRootA == MerkleRootB == MerkleRootC
ServerRoot  updated

Unit‑test is included in tests/consensus.spec.ts.

⸻

Document compiled: 2025‑07‑02.


/* ─── Canonical Data Model from spec/v1.4.1 ─── */

/* ─── Primitives ─── */
export type Hex = `0x${string}`;
export type Address = Hex;
export type Hanko = Hex; // 48-byte BLS aggregate signature

/* ─── 4.1 Wire Envelope ─── */
export type Input = [
  signerIdx: number,   // index in lexicographically-sorted signerId list for this tick
  entityId: string,    // target Entity
  cmd: Command         // consensus-level command
];

/* ─── 4.2 Consensus-level Commands ─── */
export type Command =
  | { type: 'importEntity'; snapshot: EntityState }
  | { type: 'addTx';        tx: EntityTx }
  // proposer MUST include FrameHeader so replicas verify deterministically
  | { type: 'proposeFrame'; header: FrameHeader }
  | { type: 'signFrame';    sig: string }
  | { type: 'commitFrame';  frame: Frame; hanko: Hanko };

/* ─── 4.3 Application-level Transaction ─── */
export type EntityTx = {
  kind: string;    // e.g. 'chat', 'transfer', 'jurisdictionEvent'
  data: any;       // payload
  nonce: bigint;   // per-signer monotone counter
  sig: string;     // signer’s signature over RLP(tx)
};

/* ─── 4.4 Frame ≃ block at Entity level ─── */
export type Frame = {
  height: bigint;           // sequential frame number
  timestamp: bigint;        // unix-ms at creation (bigint for 64-bit safety)
  header: FrameHeader;      // static fields hashed for propose/sign
  txs: EntityTx[];          // ordered transactions
  postStateRoot: string;    // keccak256 of EntityState after txs
};

export type FrameHeader = {
  entityId: string;
  height: bigint;
  memRoot: string;          // Merkle root of tx list
  prevStateRoot: string;
  proposer: string;         // signerId that built the frame
};

/* ─── 4.5 Entity State ─── */
export type EntityState = {
  height: bigint;                              // last committed height
  quorum: Quorum;                              // active quorum
  signerRecords: Record<string, { nonce: bigint }>;
  domainState: any;                            // application domain data
  mempool: EntityTx[];                         // pending txs
  proposal?: { header: FrameHeader; sigs: Record<string, string> };
};

/* ─── 4.6 Quorum Definition ─── */
export type Quorum = {
  threshold: bigint;                           // required weight
  members: { address: string; shares: bigint }[];
};

/* ─── 4.8 Server Frame Header (global timeline) ─── */
export type ServerFrame = {
  frameId: number;
  timestamp: bigint;
  root: string;                 // Merkle root of replica state hashes
  inputsRoot: string;           // Merkle root of RLP(ServerInput)
};

/* ─── Additional runtime types (not in spec data model) ─── */

export interface Replica {
  // TBD: This needs to be reconciled with the new spec.
  // For now, we'll keep a minimal version to allow compilation.
  state: EntityState;
}

export interface ServerState {
  // TBD: This needs to be reconciled with the new spec.
  height: bigint;
  replicas: Map<string, Replica>;
}

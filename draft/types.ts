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

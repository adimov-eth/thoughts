/* ──────────── primitive brands ──────────── */
export type Hex     = `0x${string}`;
export type Address = Hex;
export type UInt64  = bigint;          // big‑endian, left‑stripped
export type Nonce   = UInt64;
export type TS      = number;          // ms‑since‑epoch

/* ──────────── signer & quorum ──────────── */
export interface SignerRecord {
  nonce : Nonce;
  shares: number;                      // voting power
}
export interface Quorum {
  threshold: number;                   // ≥ Σ(shares) to commit
  members  : Record<Address, SignerRecord>;
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
  sig  : Hex;                          // BLS12‑381 sig (single)
}
export type ChatTx      = BaseTx<'chat'> & { body:{ message:string } };
export type Transaction = ChatTx;

/* ──────────── frames ──────────── */
export interface Frame<T = unknown> {
  height: UInt64;
  ts    : TS;
  txs   : Transaction[];
  state : T;
}
export interface ProposedFrame<T = unknown> extends Frame<T> {
  sigs: Map<Address, Hex>;             // individual sigs
  hash: Hex;                           // hash(frame)
}
export type Hanko = Hex;               // aggregate BLS sig, 48 B

/* ──────────── replica addressing ──────────── */
export interface ReplicaAddr {
  jurisdiction: string;
  entityId    : string;
  signerId?   : string;
}
export const addrKey = (a: ReplicaAddr) =>
  `${a.jurisdiction}:${a.entityId}`;

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
  | { type:'PROPOSE'; addrKey: string; ts: TS }
  | { type:'SIGN'   ; addrKey: string; signer: Address;
                      frameHash: Hex; sig: Hex }
  | { type:'COMMIT' ; addrKey: string; hanko: Hanko;
                      frame: Frame<EntityState> };

/* ──────────── wire envelope (transport‑neutral) ──────────── */
export interface Input {
  from: Address;
  to  : Address;
  cmd : Command;
}

/* ──────────── server frame ──────────── */
export interface ServerFrame {
  height: UInt64;   // ++ each tick
  ts    : TS;       // wall-clock timestamp
  inputs: Input[];  // executed inputs
  root  : Hex;      // Merkle root of snapshots
  hash  : Hex;      // keccak256(rlp(ServerFrame without hash))
}

/* ──────────── server state ──────────── */
export interface ServerState {
  height  : UInt64;                     // last committed ServerFrame.height
  replicas: Map<string, Replica>;       // key = addrKey:signer
}

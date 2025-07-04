/* eslint-disable @typescript-eslint/consistent-type-definitions */
export type Big = bigint;
export type Address = `0x${string}`;
export type SignerIdx = number;

/* ── low-level wire envelope ─────────────────────────────── */
export type Input = [SignerIdx, string, Command];

/* ── consensus-level commands ────────────────────────────── */
export type Command =
  | { type: "importEntity"; snapshot: EntityState }
  | { type: "addTx"; tx: EntityTx }
  | { type: "proposeFrame"; header: FrameHeader }
  | { type: "signFrame"; sig: string }
  | { type: "commitFrame"; frame: Frame; hanko: string }
  | { type: "attachReplica"; snapshot: EntityState }
  | { type: "detachReplica" };

/* ── application-level transaction ───────────────────────── */
export type EntityTx = { kind: string; data: unknown; nonce: Big; sig: string };

/* ── quorum definition ───────────────────────────────────── */
export type Quorum = {
  threshold: Big;
  members: { address: Address; shares: Big }[];
};

/* ── frame structs ───────────────────────────────────────── */
export type FrameHeader = {
  entityId: string;
  height: Big;
  memRoot: string;
  prevStateRoot: string;
  proposer: Address;
};

export type Frame = {
  header: FrameHeader;
  txs: EntityTx[];
  timestamp: Big;
  postStateRoot: string;
};

/* ── entity / replica / server state ─────────────────────── */
export type EntityState = {
  height: Big;
  quorum: Quorum;
  signerRecords: Record<Address, { nonce: Big }>;
  domainState: unknown;
  mempool: EntityTx[];
  proposal?: { header: FrameHeader; sigs: Record<Address, string> };
};

export type Replica = { attached: boolean; state: EntityState };
export type ServerState = Map<`${SignerIdx}:${string}`, Replica>;

/* ── batch + frame objects at server level ───────────────── */
export type ServerInput = {
  inputId: string;
  frameId: number;
  timestamp: Big;
  inputs: Input[];
};

export type ServerFrame = {
  frameId: number;
  timestamp: Big;
  root: string;
  inputsRoot: string;
};

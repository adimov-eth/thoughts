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
export type EntityTx = { 
  kind: string; 
  data: unknown; 
  nonce: Big; 
  from: Address;  // signerId, recovered from signature
  sig: string; 
};

/* ── quorum definition ───────────────────────────────────── */
export type Quorum = {
  threshold: Big;
  members: { 
    address: Address; 
    shares: Big;
    pubKey?: string; // BLS public key (hex) - optional for backwards compat
  }[];
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

/* ── additional types from v1.4.1-RC2 spec ────────────────── */
export interface EntityInput {
  jurisdictionId: string;
  signerId: string;
  entityId: string;
  quorumProof: QuorumCertificate;
  entityTxs: EntityTx[];
  precommits: string[];
  proposedBlock: string;
  observedInbox: InboxMessage[];
  accountInputs: AccountInput[];
}

export interface QuorumCertificate {
  quorumHash: string;
  quorumStructure: string;
}

export interface InboxMessage {
  msgHash: string;
  fromEntityId: string;
  message: unknown;
}

export interface AccountInput {
  counterEntityId: string;
  channelId?: Big;
  accountTxs: AccountTx[];
}

export interface AccountTx {
  kind: string;
  args: unknown;
  sig: string;
  nonce: Big;
  from: Address;
}

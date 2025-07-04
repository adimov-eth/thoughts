/* ─── Canonical Data Model from spec/v1.4.1-RC2 ─── */

/* ─── Primitives ─── */
export type Hex = `0x${string}`;
export type Address = Hex;
export type Hanko = Hex; // 48-byte BLS aggregate signature

/* ─── 4.1 Wire Envelope ─── */
export type Input = [
  signerIdx: number, // lexicographic index of signerId present this tick
  entityId: string, // target Entity
  cmd: Command, // consensus-level command
];

/* ─── 4.2 Consensus-level Commands ─── */
export type Command =
  | { type: "importEntity"; snapshot: EntityState }
  | { type: "addTx"; tx: EntityTx }
  // Proposer ships only the header to save bandwidth; replicas reconstruct tx list
  | { type: "proposeFrame"; header: FrameHeader }
  | { type: "signFrame"; sig: string }
  | { type: "commitFrame"; frame: Frame; hanko: Hanko };

/* ─── 4.3 Application-level Transaction ─── */
export interface EntityTx {
  kind: string; // e.g. 'chat', 'transfer', 'jurisdictionEvent'
  data: unknown; // domain payload; must be type-checked by application logic
  nonce: bigint; // strictly increasing per-signer
  from: Address; // signerId, recovered from signature
  sig: string; // signer’s signature over RLP(tx)
}

/* ─── 4.4 Frame (Entity-level block) ─── */
export interface Frame {
  height: bigint; // sequential frame number
  timestamp: bigint; // unix-ms at creation (bigint for 64-bit safety)
  header: FrameHeader; // static fields hashed for propose/sign
  txs: EntityTx[]; // ordered transactions
  postStateRoot: string; // keccak256 of EntityState after txs
}

export interface FrameHeader {
  entityId: string;
  height: bigint;
  memRoot: string; // Merkle root of *sorted* tx list (see §5 Y-2 rule)
  prevStateRoot: string;
  proposer: string; // signerId that built the frame
}

/* ─── 4.5 Entity State ─── */
export interface EntityState {
  height: bigint; // last committed height
  quorum: Quorum; // active quorum
  signerRecords: Record<string, { nonce: bigint }>;
  domainState: unknown; // application domain data
  mempool: EntityTx[]; // pending txs
  proposal?: { header: FrameHeader; sigs: Record<string, string> };
}

/* ─── 4.6 Quorum Definition ─── */
export interface Quorum {
  threshold: bigint; // required weight
  members: { address: string; shares: bigint }[];
}

/* ─── 4.7 Server-input Batch ─── */
export interface ServerInput {
  inputId: string; // UID for the batch
  frameId: number; // monotone tick counter
  timestamp: bigint; // unix-ms
  metaTxs: ServerMetaTx[]; // network-wide cmds (renamed per Y-1)
  entityInputs: EntityInput[]; // per-entity signed inputs
}

export type ServerMetaTx =
  // was ServerTx
  { type: "importEntity"; entityId: string; data: unknown };
// Additional server-level transaction types can be added here

export interface EntityInput {
  jurisdictionId: string; // format chainId:contractAddr
  signerId: string; // BLS public key (hex)
  entityId: string;
  quorumProof: QuorumCertificate;
  entityTxs: EntityTx[]; // includes jurisdictionEvent txs
  precommits: string[]; // BLS sigs over header hash
  proposedBlock: string; // keccak256(rlp(header ‖ txs))
  observedInbox: InboxMessage[];
  accountInputs: AccountInput[];
}

export interface QuorumCertificate {
  quorumHash: string;
  quorumStructure: string; // reserved – must be '0x' until Phase 3
}

export interface InboxMessage {
  msgHash: string; // keccak256(message)
  fromEntityId: string;
  message: unknown;
}

export interface AccountInput {
  counterEntityId: string;
  channelId?: bigint; // reserved for phase 2 multi-channel support
  accountTxs: AccountTx[];
}

export interface AccountTx {
  type: "AddPaymentSubcontract";
  paymentId: string;
  amount: number;
}

/* ─── 4.8 Server Frame (global timeline) ─── */
export interface ServerFrame {
  frameId: number;
  timestamp: bigint;
  root: string; // Merkle root of replica state hashes
  inputsRoot: string; // Merkle root of RLP(ServerInput)
}

/* ─── Additional runtime types (not in spec data model) ─── */

export interface Replica {
  state: EntityState;
}

export interface ServerState {
  height: bigint;
  replicas: Map<string, Replica>;
}

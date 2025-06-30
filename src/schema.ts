/* =========================================================================
   PRIMITIVE BRANDS
   ========================================================================= */
export type Hex     = `0x${string}`;
export type Address = Hex;
export type UInt64  = bigint;
export type TS      = number;          // ms since Unix‑epoch (rounded - see server)

/* =========================================================================
   SIGNERS & QUORUM
   ========================================================================= */
export interface SignerMeta { address: Address; shares: number; }
export interface Quorum {
  readonly threshold : number;
  readonly members   : readonly SignerMeta[];
}

/* =========================================================================
   TRANSACTIONS
   ========================================================================= */
export const enum TxKind { Chat = 'chat' }

export interface BaseTx<K extends TxKind = TxKind> {
  readonly kind  : K;
  readonly nonce : UInt64;
  readonly from  : Address;
  readonly body  : unknown;
  readonly sig   : Hex;
}

export type ChatTx      = BaseTx<TxKind.Chat> & { body: { message: string } };
export type Transaction = ChatTx;

/* =========================================================================
   FRAMES
   ========================================================================= */
export interface Frame<T = unknown> {
  readonly height : UInt64;
  readonly ts     : TS;
  readonly txs    : readonly Transaction[];
  readonly state  : T;
}
export interface ProposedFrame<T = unknown> extends Frame<T> {
  readonly sigs : ReadonlyMap<Address, Hex>;
}

/* =========================================================================
   ENTITY REPLICA
   ========================================================================= */
export const enum Stage { Ready = 'ready', Awaiting = 'awaiting' }

export interface EntityState {
  readonly quorum : Quorum;
  readonly nonces : Record<Address, UInt64>;
  readonly chat   : { from: Address; msg: string; ts: TS }[];
}

export interface Replica {
  /* identity */
  readonly id        : string;
  readonly address   : Address;
  /* governance */
  readonly quorum    : Quorum;
  readonly proposer  : Address;
  readonly stage     : Stage;
  /* working sets */
  readonly mempool   : readonly Transaction[];
  readonly last      : Frame<EntityState>;
  readonly proposal? : ProposedFrame<EntityState>;
}

/* =========================================================================
   SERVER‑LEVEL COMMANDS (patched)
   ========================================================================= */
export type Command =
  | { type:'IMPORT'   ; replica: Replica }
  | { type:'ADD_TX'   ; entityId: string; tx: Transaction }
  | { type:'PROPOSE'  ; entityId: string }
  | { type:'SIGN_REQ' ; entityId: string; frameHash: Hex }
  | { type:'SIGN'     ; entityId: string; signer: Address; frameHash: Hex; sig: Hex }
  | { type:'COMMIT'   ; entityId: string; frame: Frame<EntityState> };

export interface Envelope {
  readonly from : Address;             // signer@entity.jurisdiction → see server
  readonly to   : Address;
  readonly cmd  : Command;
}
/* TODO(codegen) : generate runtime validators from this file later */

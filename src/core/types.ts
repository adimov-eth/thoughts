export type Hash256 = Uint8Array & { __brand: "hash256" };

export interface Tx {
  from: string;
  to: string;
  value: bigint;
}

/** One deterministic ledger step agreed on by replicas. */
export interface Frame {
  /** Sequential identifier (height). */
  id: number;
  /** State root *before* this frame’s txs are applied. */
  prevState: Hash256;
  /** ✅ NEW: state root *after* tx execution, signed by replicas. */
  postState: Hash256;
  /** Ordered list of user transactions. */
  txs: readonly Tx[];
}

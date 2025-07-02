import { Hash256 } from "./types.js";

/** A single BLS vote for `frame.postState`. */
export interface Vote {
  signer: string; // BLS public‑key ID (hex or bech32)
  sig: Uint8Array; // BLS signature
  nonce: number; // monotonically increasing per signer
  msg: Hash256; // always equals frame.postState
}

export interface QuorumArgs {
  votes: readonly Vote[];
  weightMap: Record<string, number>;
  /** Minimum weight required to commit (e.g. ceil(total × 2/3)). */
  threshold: number;
  /** Latest accepted nonce per signer. */
  nonceMap: Record<string, number>;
}

/**
 * True ⇢ quorum reached **and** no replay / duplicate attack detected.
 * ‑ ignores duplicate votes from the same signer
 * ‑ aborts early on stale or skipped nonces
 * ‑ O(n) in number of votes, constant memory
 */
export function hasQuorum({
  votes,
  weightMap,
  threshold,
  nonceMap,
}: QuorumArgs): boolean {
  const seen = new Set<string>();
  let weight = 0;

  for (const v of votes) {
    const lastNonce = nonceMap[v.signer] ?? 0;
    if (v.nonce !== lastNonce + 1) return false; // ⚠️ replay or skip

    if (seen.has(v.signer)) continue; // dup signer → ignore
    seen.add(v.signer);

    weight += weightMap[v.signer] ?? 0;
    if (weight >= threshold) return true; // fast exit
  }
  return false;
}

import keccak256 from "keccak256";
import { concat } from "uint8arrays";
import { encFrameForSigning } from "../codec/rlp";
import { encode as rlpEncode } from "@ethereumjs/rlp";

const canonicalize = (v: any): any => {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object")
    return Object.keys(v)
      .sort()
      .map((k) => [k, canonicalize(v[k])]);
  return v;
};
import type { EntityTx, FrameHeader, ServerState, Input } from "../types";

/* ── Merkle helper (unchanged) ───────────────────────────── */
export const merkle = (leaves: Uint8Array[]): Uint8Array => {
  if (leaves.length === 1) return leaves[0];
  const next: Uint8Array[] = [];
  for (let i = 0; i < leaves.length; i += 2) {
    const left = leaves[i];
    const right = i + 1 < leaves.length ? leaves[i + 1] : left;
    next.push(keccak256(Buffer.from(concat([left, right]))));
  }
  return merkle(next);
};

/* ── entity frame hash (R-1 fix) ─────────────────────────── */
export const hashFrame = (hdr: FrameHeader, txs: EntityTx[]): Uint8Array => {
  return keccak256(encFrameForSigning(hdr, txs));
};

/* ── global server Merkle root ───────────────────────────── */
export const computeServerRoot = (state: ServerState): Uint8Array => {
  // Sort entries by key to ensure deterministic ordering
  const leaves = [...state.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, replica]) => keccak256(Buffer.from(rlpEncode(canonicalize(replica.state)))));
  return merkle(leaves);
};

/* ── batch hash for ServerFrame.inputsRoot ───────────────── */
export const computeInputsRoot = (batch: Input[]): Uint8Array => {
  // Sort by signerIdx for deterministic ordering
  const sortedInputs = [...batch]
    .sort((a, b) => a[0] - b[0])
    .map((input) => keccak256(Buffer.from(rlpEncode(canonicalize(input)))));
  return merkle(sortedInputs);
};

/* ── mempool Merkle root ─────────────────────────────────────── */
export const computeMemRoot = (txs: EntityTx[]): Uint8Array => {
  if (txs.length === 0) {
    return keccak256(Buffer.from([]));
  }
  const leaves = txs.map((tx) => keccak256(Buffer.from(rlpEncode(canonicalize(tx)))));
  return merkle(leaves);
};

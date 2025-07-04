import keccak256 from "keccak256";
import { concat } from "uint8arrays";
import { encFrameForSigning } from "../codec/rlp";
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
  // This is a placeholder implementation
  const leaves = [...state.replicas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, r]) => keccak256(JSON.stringify(r.state)));
  return keccak256(Buffer.from(merkle(leaves)));
};

/* ── batch hash for ServerFrame.inputsRoot ───────────────── */
export const computeInputsRoot = (batch: Input[]): Uint8Array => {
  // This is a placeholder implementation
  const sortedInputs = batch
    .sort((a, b) => a[0] - b[0])
    .map((i) => keccak256(JSON.stringify(i)));
  return keccak256(Buffer.from(merkle(sortedInputs)));
};

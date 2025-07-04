import type { EntityTx, FrameHeader, EntityState } from "./types";
import { hashFrame } from "./hash";

/**
 * Canonical transaction sorting rule (Y-2):
 * Sort by: nonce → from (signerId) → kind → insertion-index
 */
export const sortTransactions = (txs: EntityTx[]): EntityTx[] => {
  return [...txs].sort((a, b) => {
    // 1. Sort by nonce
    if (a.nonce !== b.nonce) return a.nonce < b.nonce ? -1 : 1;
    // 2. Sort by from address
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    // 3. Sort by kind
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    // 4. Insertion order is implicit (stable sort)
    return 0;
  });
};

/**
 * Select proposer for a given height
 * Simple round-robin based on height modulo quorum size
 */
export const selectProposer = (
  height: bigint,
  quorumMembers: { address: string }[],
): string => {
  if (quorumMembers.length === 0) throw new Error("No quorum members");
  const index = Number(height % BigInt(quorumMembers.length));
  return quorumMembers[index].address;
};

/**
 * Build a frame header for proposing
 */
export const buildFrameHeader = (
  entityId: string,
  height: bigint,
  txs: EntityTx[],
  prevStateRoot: string,
  proposer: string,
): FrameHeader => {
  const sortedTxs = sortTransactions(txs);
  const memRoot =
    "0x" +
    Buffer.from(
      hashFrame(
        {
          entityId,
          height,
          memRoot: "", // placeholder for hash calculation
          prevStateRoot,
          proposer: proposer as `0x${string}`,
        },
        sortedTxs,
      ),
    ).toString("hex");

  return {
    entityId,
    height,
    memRoot,
    prevStateRoot,
    proposer: proposer as `0x${string}`,
  };
};

/**
 * Verify that a proposed frame header matches local state
 */
export const verifyFrameHeader = (
  header: FrameHeader,
  localState: EntityState,
  mempool: EntityTx[],
): boolean => {
  const sortedTxs = sortTransactions(mempool);
  const expectedHash = hashFrame(header, sortedTxs);
  const expectedHashHex = "0x" + Buffer.from(expectedHash).toString("hex");

  return header.memRoot === expectedHashHex;
};

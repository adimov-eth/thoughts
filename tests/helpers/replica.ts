import type {
  Replica,
  EntityState,
  Quorum,
  Address,
} from "../../src/types";

export const createBlankReplica = (): Replica => {
  const quorum: Quorum = {
    threshold: 1n,
    members: [
      {
        address: "0x0000000000000000000000000000000000000001" as Address,
        shares: 1n,
        pubKey: "0x" + "0".repeat(96), // 48 bytes in hex = 96 chars
      },
    ],
  };

  const state: EntityState = {
    height: 0n,
    quorum,
    signerRecords: {
      "0x0000000000000000000000000000000000000001": { nonce: 0n },
    },
    domainState: { chat: [] },
    mempool: [],
  };

  return {
    attached: true,
    state,
  };
};
